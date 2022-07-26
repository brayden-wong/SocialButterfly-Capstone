import express from 'express';
import {Connection, Channel} from 'amqplib';
import amqp from 'amqplib';
import mailer from 'nodemailer';
import config from './config/config';

const app = express();
const createChannels = async() => {
    const url = String(config.queue);
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();

    await channel.assertQueue('register account');
    await channel.assertQueue('event reminder');
    await channel.assertQueue('reset password');
    await channel.assertQueue('rsvp');
};

setTimeout(() => {
    createChannels()
}, 5000);

let url = 'amqp://rabbitmq';
let connection: Connection;
let channel: Channel;

const createConnection = async(url: string, connection: Connection, channel: Channel) => {
    connection = await amqp.connect(url);
    channel = await connection.createChannel();
    return channel;
}

const sendEmail = (data : amqp.ConsumeMessage | null) => {
    if(data !== null) {
        let options = JSON.parse(data.content.toString());
        options.from = config.username;
        const service =  process.env.service || 'gmail';
        
        const transporter = mailer.createTransport({
            service: service,
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: config.username,
                pass: config.password,
            },
            logger: true
        });

        transporter.sendMail(options);
    } else return;
}

const consumeAccount = async() => {
    channel = await createConnection(url, connection, channel);
    channel.consume('register account', data => {
        sendEmail(data);
    });
}

const consumeResetPassword = async() => {
    channel = await createConnection(url, connection, channel);
    channel.consume('reset password', data => {
        sendEmail(data);
    });
};

const consumeRSVP = async() => {
    channel = await createConnection(url, connection, channel);
    channel.consume('rsvp', data => {
        sendEmail(data);
    });
}

const consumeReminder = async() => {
    channel = await createConnection(url, connection, channel);
    channel.consume('event reminder', data => {
        sendEmail(data);
    })
}

setTimeout(() => {
    consumeAccount();
    setTimeout(() => {
        consumeRSVP();
        setTimeout(() => {
            consumeReminder();
            setTimeout(() => {
                consumeResetPassword();
            }, 15000);
        }, 15000);
    }, 15000);
}, 15000);

app.listen(config.port);