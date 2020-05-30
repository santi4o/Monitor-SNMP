from pysnmp.hlapi import *
from plyer import notification
import time
import sys

if len(sys.argv) < 3:
	print("\tUso:\n\tpython anchoBanda.py <IP> <COMUNIDAD>")
	sys.exit()

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
			break
		elif errorStatus:
			print('%s at %s' % (errorStatus.prettyPrint(),
                                errorIndex and varBinds[int(errorIndex)-1][0] or '?'))
			break
		else:
			#for varBind in varBinds:
			#	print(' = '.join([x.prettyPrint() for x in varBind]))
			interfacesInfo.append(varBinds)
	return interfacesInfo

anterior = 0.0

while True:
	ifIn1 = []
	ifOut1 = []
	ifIn2 = []
	ifOut2 = []
	ifDescrs = []
	ifSpeeds = []

	start = time.time()
	interfacesInfo = snmpGet(sys.argv[1], sys.argv[2])
	#interfacesInfo.pop()
	#print "numero de interfaces: ", len(interfacesInfo), "\n-----------------------"

	for interface in interfacesInfo:
		ifIn1.append(float(interface[0][1]))
		ifOut1.append(float(interface[1][1]))
	time.sleep(1)
	interfacesInfo = snmpGet(sys.argv[1], sys.argv[2])
	end = time.time()
	#interfacesInfo.pop()
	#print "numero de interfaces: ", len(interfacesInfo), "\n-----------------------"

	for interface in interfacesInfo:
		ifIn2.append(float(interface[0][1]))
		ifOut2.append(float(interface[1][1]))
		ifDescrs.append(interface[3][1])
		ifSpeeds.append(float(interface[2][1]))

	delta_secs = end - start

	#for x in range(len(interfacesInfo)):
	#	print "\ninterfaz: ", ifDescrs[x]
	#	print "ifInOctets_1: ", ifIn1[x]
	#	print "ifOutOctets_1: ", ifOut1[x]

	#for x in range(len(interfacesInfo)):
	#	print "\ninterfaz: ", ifDescrs[x]
	#	print "ifInOctets_2: ", ifIn2[x]
	#	print "ifOutOctets_2: ", ifOut2[x]

	#for x in range(len(interfacesInfo)):
	#	print "\ninterfaz: ", ifDescrs[x]
	#	print "speed: ", ifSpeeds[x]

	#print "delta_secs: ", delta_secs
	print interfacesInfo[0][4][1]
	print "\n\tmedido con half duplex:\n"
	acum = 0.0
	for x in range(len(interfacesInfo)):
		util = (((ifIn2[x]-ifIn1[x]) + (ifOut2[x]-ifOut1[x])) * 8 * 100) / (delta_secs * ifSpeeds[x])
		print "Utilizacion de ancho de banda de ", ifDescrs[x], " : ",
		print ("%.6f" % util)
		acum += util
	prom = acum / float(len(interfacesInfo))
	print "\npromedio de utilizacion de ancho de banda en ", interfacesInfo[0][4][1], ": ", prom

	if prom > anterior:

		notification.notify(
			title='Promedio de utilizacion de ancho de banda superado',
			message='utilizacion de ancho de banda en %s = %f' % (interfacesInfo[0][4][1], prom),
			app_name='SNMP'
		)
	anterior = prom
