from pysnmp.hlapi import *
errorIndication, errorStatus, errorIndex, varBinds = next(
	getCmd(SnmpEngine(),
               CommunityData('53fd33.0', mpModel=0),
               UdpTransportTarget(('192.168.100.10', 161)),
               ContextData(),
               ObjectType(ObjectIdentity('SNMPv2-MIB', 'sysName', 0)),
               ObjectType(ObjectIdentity('SNMPv2-MIB', 'sysDescr', 0)),
               ObjectType(ObjectIdentity('IF-MIB', 'ifDescr', 1)))
)

if errorIndication:
	print(errorIndication)
elif errorStatus:
	#print('%s at %s' % (errorStatus.prettyPrint(),
         #                   errorIndex and varBinds[int(errorIndex) - 1][0] or '?'))
        print("error")

else:
	for varBind in varBinds:
		print(' = '.join([x.prettyPrint() for x in varBind]))
sys.stdout.flush()
