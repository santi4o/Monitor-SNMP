from pysnmp.hlapi import *
import time
import sys
import pymongo
from pymongo import *
from pprint import pprint
import json
#from json import JSONEncoder


client = MongoClient('localhost', 27017)
db = client.MonitorRed

if len(sys.argv) < 3:
	print("\tUso:\n\tpython snmpResUsageUbuntu.py <IP> <COMUNIDAD>")
	sys.exit()

def getCPUMemUsage(ip, comunidad):
    errorIndication, errorStatus, errorIndex, varBinds = next(
    	getCmd(SnmpEngine(),
                   CommunityData(comunidad, mpModel=0),
                   UdpTransportTarget((ip, 161)),
                   ContextData(),
    			   ObjectType(ObjectIdentity('.1.3.6.1.4.1.2021.10.1.3.2')), #carga del cpu de 5 minutos para ubuntu
    			   ObjectType(ObjectIdentity('.1.3.6.1.4.1.2021.9.1.9.1')), #porcentaje de uso del disco para ubuntu
                   ObjectType(ObjectIdentity('.1.3.6.1.4.1.2021.4.6.0')), #memoria libre en KB
    			   ObjectType(ObjectIdentity('.1.3.6.1.4.1.2021.4.5.0'))) #memoria total en KB
    )

    if errorIndication:
    	print(errorIndication)
    	sys.exit(1)

    elif errorStatus:
    	print('%s at %s' % (errorStatus.prettyPrint(), errorIndex and varBinds[int(errorIndex) - 1][0] or '?'))
        #print("error")
    	sys.exit(1)

    else:
        return varBinds
    	#for varBind in varBinds:
    	#	print(' = '.join([x.prettyPrint() for x in varBind]))

def snmpGet(ip, comunidad):
	interfacesInfo = []
	for (errorIndication,
         errorStatus,
         errorIndex,
         varBinds) in nextCmd(SnmpEngine(),
                              CommunityData(comunidad, mpModel=0),
                              UdpTransportTarget((ip, 161)),
                              ContextData(),
                              ObjectType(ObjectIdentity('IF-MIB', "ifInOctets")),
                              ObjectType(ObjectIdentity('IF-MIB', "ifOutOctets")),
                              ObjectType(ObjectIdentity('IF-MIB', "ifSpeed")),
                              ObjectType(ObjectIdentity('IF-MIB', 'ifDescr')),
                              ObjectType(ObjectIdentity('SNMPv2-MIB', 'sysName')),
                              lexicographicMode=False):

		if errorIndication:
			print(errorIndication)
			sys.exit(1)
		elif errorStatus:
			print('%s at %s' % (errorStatus.prettyPrint(),
                                errorIndex and varBinds[int(errorIndex)-1][0] or '?'))
			sys.exit(1)
		else:
			#for varBind in varBinds:
			#	print(' = '.join([x.prettyPrint() for x in varBind]))
			interfacesInfo.append(varBinds)
	return interfacesInfo

#while True:

ifIn1 = [] #se obtienen de la base de datos
ifOut1 = [] #se obtienen de la base de datos
ifIn2 = []
ifOut2 = []
ifDescrs = []
ifSpeeds = []
util = [] #utilizacion del ancho de banda por cada interfaz

ifOctets1 = db.ifOctets.find_one(
    {'agente': str(sys.argv[1])},
     sort=[( '_id', pymongo.DESCENDING)]
)

    #print (ifOctets1[].interfacesInfo["lo"])
    #for interface in interfacesInfo:
    #    if (str(interface[3][1]) ==

interfacesInfo = snmpGet(sys.argv[1], sys.argv[2])
end = time.time()

for interface in interfacesInfo:
    print "\ninterfaz: ", interface[3][1]
    print "ifInOctets_2: ", interface[0][1]
    print "ifOutOctets_2: ", interface[1][1]

##interfacesInfo.pop()
##print "\n-----------------------\n", "numero de interfaces: ", len(interfacesInfo)

if (ifOctets1 is None):
	print "no hay documentos en ifOctets1"
	print "Informacion del ancho de banda establecida en 0\n"

else:
    pprint(ifOctets1)
    #print "size is: ", ifOctets1.count()
    #checa que el nombre de las interfaces coincida y guarda la informacion en los arreglos de arriba
    start = float(ifOctets1['tiempo'])
    for interface in interfacesInfo:
        for mongoInterface in ifOctets1['interfacesInfo']:
            if (str(interface[3][1]) == str(mongoInterface['ifDescr'])):
                print "El nombre ", interface[3][1], " coincidio"
            	ifIn1.append(float(mongoInterface['ifInOctets']))
            	ifOut1.append(float(mongoInterface['ifOutOctets']))
                ifIn2.append(float(interface[0][1]))
                ifOut2.append(float(interface[1][1]))
                ifDescrs.append(interface[3][1])
            	ifSpeeds.append(float(interface[2][1]))
    delta_secs = end - start
    print (delta_secs)
    print interfacesInfo[0][4][1]#el nombre del dispositivo

    #interfaceobjs = []

    print "\n\tmedido con half duplex:\n"
    #acum = 0.0         ------util para calcular un promedio de utilizacion de ancho de banda en el dispositivo
    for x in range(len(interfacesInfo)):
        util.append((((ifIn2[x]-ifIn1[x]) + (ifOut2[x]-ifOut1[x])) * 8 * 100) / (delta_secs * ifSpeeds[x]))
        print "Utilizacion de ancho de banda en ", ifDescrs[x], " : ",
        print ("%.6f" % util[x])

print len(ifDescrs), "=", len(util)
console = sys.stdout
sys.stdout = open('agentInterfacesTemp.json', 'w')
print '{'
print '  "agente" : "{}",'.format(sys.argv[1])
print '  "tiempo" : ', end, ','
print '  "interfacesInfo" : ['
for x in range(len(interfacesInfo)):
    print '    {'
    print '      "ifDescr" : "{}",'.format(str(interfacesInfo[x][3][1]))
    print "      \"ifInOctets\" : ", float(interfacesInfo[x][0][1]), ","
    print "      \"ifOutOctets\" : ", float(interfacesInfo[x][1][1])
    print "    }"
    if (x != len(interfacesInfo)-1):
        print "    ,"
print "  ]"
print "}"
sys.stdout = console
with open('agentInterfacesTemp.json') as f:
    file_data = json.load(f)
result = db.ifOctets.insert_one(file_data)
print('Inserted document as {0}'.format(result.inserted_id))
#print (util)

print (util)

cpu_mem = getCPUMemUsage(sys.argv[1], sys.argv[2])

libre = float(cpu_mem[2][1])
total = float(cpu_mem[3][1])
memUtil = ((total-libre) / total) * 100

sys.stdout = open('resourcesUtil.json', 'w')
print '{'
print '  "agente" : "{}",'.format(sys.argv[1])
print '  "cpu" : ', cpu_mem[0][1], ','
print '  "memoria" : ', memUtil, ','
print '  "disco" : ', cpu_mem[1][1], ','
print '  "anchoBanda" : ['

if (len(ifDescrs) == 0): #si no se genero informacion de bandwidthUtil
	for x in range(len(interfacesInfo)):
		print '    {'
		print '      "ifDescr" : "{}",'.format(str(interfacesInfo[x][3][1]))
		print "      \"utilizacion\" : 0"
		print "    }"
		if (x != len(interfacesInfo)-1):
			print "    ,"
else:
	for x in range(len(util)):#si se genero informacion de bandwidthUtil
		print '    {'
		print '      "ifDescr" : "{}",'.format(ifDescrs[x])
		print '      "utilizacion" : {}'.format(float(util[x]))
		print '    }'
		if (x != len(util)-1):
			print "    ,"
print "  ]"
print "}"

sys.stdout = console
with open('resourcesUtil.json') as f:
    file_data = json.load(f)
result = db.resourcesUtil.insert_one(file_data)
print('Inserted document as {0}'.format(result.inserted_id))
