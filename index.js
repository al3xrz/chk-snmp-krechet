const snmp = require('net-snmp')
const ZabbixSender = require('node-zabbix-sender')
const sender = new ZabbixSender({ host: '127.0.0.1' })
const ping = require('ping');
const options = {
    port: 161,
    retries: 1,
    timeout: 5000,
    backoff: 1.0,
    transport: "udp4",
    trapPort: 162,
    version: snmp.Version1,
    backwardsGetNexts: true,
    idBitsSize: 32
};



const hosts = [{
    name: 'krechet-1709042',
    ip: '192.168.20.2'
}
    , 
    {
        name: 'krechet-1709041',
        ip: '192.168.54.2'
    },
    {
        name: 'olvia-000001',
        ip: '192.168.75.2'
    }, {
        name: 'krechet-1709043',
        ip: '192.168.65.2'
    }, {
        name: "krechet-1709040",
        ip: "192.168.36.2"
    }

]


function getInfo(host, oids) {
    let session = snmp.createSession(host, "public", options);
    return new Promise((resolve, rej) => {
        session.get(oids, (err, res) => {
            session.close()
            if (err) rej(err);
            resolve(res)
        })

    })
}

async function getStat(host) {
    const result = [];
    for (let hour = 0; hour <= 23; hour++) {


        var oids = [`1.3.6.1.4.1.3048.${hour + 2}.1.0`, `1.3.6.1.4.1.3048.${hour + 2}.4.0`, `1.3.6.1.4.1.3048.${hour + 2}.6.0`, `1.3.6.1.4.1.3048.${hour + 2}.2.0`];
        try {
            let stamp = await getInfo(host, oids)
            result.push({
                mssData: stamp[0].value.toString(),
                mssCount: stamp[1].value.toString(),
                mssVehicle: stamp[2].value.toString(),
                mssTimeStart: stamp[3].value.toString()
            })

        } catch (e) {
            console.log(e);
            result.push({
                mssData: 0,
                mssCount: 0,
                mssVehicle: 0,
                mssTimeStart: 0

            })
            //continue;
        }

    }

    return result;

}

async function createInfo(host) {

    let mssFixation = 0;
    let mssViolation = 0;
    let mssV01Violation = 0;
    let mssV04Violation = 0;
    let mssV08Violation = 0;

    try {
        const stat = await getStat(host)
        const baseDateStr = stat[0].mssData.split('    ')[0];
        for (let stamp of stat) {
            if (stamp.mssData.indexOf(baseDateStr) !== -1) {
                //console.log(stamp.mssTimeStart, stamp.mssData, stamp.mssVehicle)
                let tempFixation = 0
                let tempV01Violations = 0
                let tempV04Violations = 0
                let tempV08Violations = 0
                //console.log(tempFixation)
                if (stamp.mssVehicle.indexOf('  ') === -1) continue;
                tempFixation = stamp.mssVehicle.split('  ').reduce((acc, obj) => acc + parseInt(obj.split(' ')[2]), 0)
                tempV01Violations = parseInt(stamp.mssVehicle.split('  ')[0].split(' ')[2])
                tempV04Violations = parseInt(stamp.mssVehicle.split('  ')[1].split(' ')[2])
                tempV08Violations = parseInt(stamp.mssVehicle.split('  ')[2].split(' ')[2])
                //console.log(tempFixation)


                mssViolation += tempFixation;
                mssV01Violation += tempV01Violations;
                mssV04Violation += tempV04Violations;
                mssV08Violation += tempV08Violations;
                mssFixation += parseInt(stamp.mssCount);
            } else continue;
        }
    } catch (e) {

        mssFixation = mssViolation = mssV01Violation = mssV04Violation = mssV08Violation = -1;

        console.log(e)
    }





    return ({ mssFixation, mssV01Violation, mssV04Violation, mssV08Violation, mssViolation })


}

async function run() {
    hosts.forEach(function (host) {
        ping.sys.probe(host.ip, async isAlive => {
            if (isAlive) {
                console.log(`Host ${host.ip} is alive`)
                let result = await createInfo(host.ip);
                console.log(result)
                sender.addItem(host.name, 'mssFixation', result.mssFixation);
                sender.addItem(host.name, 'mssViolation', result.mssViolation);
                sender.addItem(host.name, 'mssV08Violation', result.mssV08Violation);
                sender.addItem(host.name, 'mssV04Violation', result.mssV04Violation);
                sender.addItem(host.name, 'mssV01Violation', result.mssV01Violation);
                sender.send((err, res) => {
                    if (err) {
                        console.log(err)
                    }
                    console.dir(res)
                })


            } else {
                
                sender.addItem(host.name, 'mssFixation', 0);
                sender.addItem(host.name, 'mssViolation', 0);
                sender.addItem(host.name, 'mssV08Violation', 0);
                sender.addItem(host.name, 'mssV04Violation', 0);
                sender.addItem(host.name, 'mssV01Violation', 0);
                sender.send((err, res) => {
                    if (err) {
                        console.log(err)
                    }
                    console.dir(res)
                })
                console.log(`host ${host.ip} unreachable`)
            }

        });
    });

}

run()











