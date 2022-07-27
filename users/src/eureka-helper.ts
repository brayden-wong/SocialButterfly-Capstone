import { Eureka }  from 'eureka-js-client';
import IP from 'ip';
const eurekaPort = 8761;
const ip = IP.address();

export default {
    registerService : (service_name: string, port: number) => {
        console.log(service_name, port);
        const client = new Eureka({
            instance : {
                app : service_name,
                hostName : service_name,
                instanceId : `${service_name}-${port}`,
                ipAddr : ip,
                port : {
                    '$': port,
                    // @ts-ignore
                    '@enabled' : 'true'
                },
                vipAddress : service_name,
                dataCenterInfo: {
                    '@class' : 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
                    name : 'MyOwn'
                }

            }, eureka : {
                host: 'eureka',
                port : eurekaPort,
                servicePath : '/eureka/apps/',
                maxRetries: 5,
                requestRetryDelay: 10000
            }
        });

        client.start(error => {
            console.log(error || `${service_name} has been registered`);
        });

        return client;
    }
}
