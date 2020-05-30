from pysnmp.hlapi import *
import json
from json import JSONEncoder
import sys

if len(sys.argv) < 3:
	print("\tUso:\n\tpython snmpGet.py <IP> <COMUNIDAD>")
	print("\n\tEjemplo:\n\tpython snmpGet.py 1.1.1.0 public")
	sys.exit()

errorIndication, errorStatus, errorIndex, varBinds = next(
	getCmd(SnmpEngine(),
               CommunityData(sys.argv[2], mpModel=0),
               UdpTransportTarget((sys.argv[1], 161)),
               ContextData(),
               ObjectType(ObjectIdentity('.1.3.6.1.4.1.9.9.109.1.1.1.1.8.1')), #El porcentaje de ocupado de la CPU total en el periodo de cinco minutos
               ObjectType(ObjectIdentity('.1.3.6.1.4.1.9.9.48.1.1.1.5.1')),#memoria usada cpu (cisco)
               ObjectType(ObjectIdentity('.1.3.6.1.4.1.9.9.48.1.1.1.5.2')),#memoria usada i/o (cisco)
               ObjectType(ObjectIdentity('.1.3.6.1.4.1.9.9.48.1.1.1.6.1')),#memoria libre cpu (cisco)
               ObjectType(ObjectIdentity('.1.3.6.1.4.1.9.9.48.1.1.1.6.2')))#memoria libre i/o (cisco)
)

if errorIndication:
	print(errorIndication)
	sys.exit(1)

elif errorStatus:
	print('%s at %s' % (errorStatus.prettyPrint(), errorIndex and varBinds[int(errorIndex) - 1][0] or '?'))
    #print("error")
	sys.exit(1)

else:
	for varBind in varBinds:
		print(' = '.join([x.prettyPrint() for x in varBind]))


	class Agente:
		def __init__(self, sysName, sysDescr, ifDescr):
			self.sysName = sysName
			self.sysDescr = sysDescr
			self.ifDescr = ifDescr

	class AgenteEncoder(JSONEncoder):
		def default(self, o):
			return o.__dict__

	ag = Agente(str(varBinds[0][1]),str(varBinds[1][1]),str(varBinds[2][1]))
	sys.stdout = open('agentinfo.json', 'w')
	print(AgenteEncoder().encode(ag))
sys.stdout.flush()
