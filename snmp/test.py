from pysnmp.hlapi import *

for (errorIndication,
     errorStatus,
     errorIndex,
     varBinds) in nextCmd(SnmpEngine(),
                          CommunityData('ESCOM', mpModel=0),
                          UdpTransportTarget(('192.168.200.1', 161)),
                          ContextData(),
                          #ObjectType(ObjectIdentity('1.3.6.1.4.1.9.9.221')),#?
                          ObjectType(ObjectIdentity('1.3.6.1.4.1.9.9.109.1.1.1.1.8')),
                          ObjectType(ObjectIdentity('1.3.6.1.4.1.9.9.48.1.1.1.2')),#nombre del pool de memoria
                          ObjectType(ObjectIdentity('1.3.6.1.4.1.9.9.48.1.1.1.5')),#memoria usada (cisco)
                          ObjectType(ObjectIdentity('1.3.6.1.4.1.9.9.48.1.1.1.6')),#memoria libre (cisco)
                          ObjectType(ObjectIdentity('1.3.6.1.4.1.5655.4.1.5.2')),
                          lexicographicMode=False):

    if errorIndication:
        print(errorIndication)
        break
    elif errorStatus:
        print('%s at %s' % (errorStatus.prettyPrint(),
                            errorIndex and varBinds[int(errorIndex)-1][0] or '?'))
        break
    else:
        for varBind in varBinds:
            print(' = '.join([x.prettyPrint() for x in varBind]))

