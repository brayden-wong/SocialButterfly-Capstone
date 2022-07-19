import express from 'express';
import {Connection, Channel} from 'amqplib';
import amqp from 'amqplib';
import mailer from 'nodemailer';
import config from './config/config';

const app = express();


const consumeAccount = async() => {
    try {
        const url = config.queue || 'amqp://localhost';
        let connection = await amqp.connect(url);
        let channel = await connection.createChannel();
        channel.consume('register account', data => {
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
        }
    });
    } catch (error) {
        console.log(error);
    }
};

const consumeResetPassword = async() => {
    try {
        const url = config.queue || 'amqp://localhost';
        let connection = await amqp.connect(url);
        let channel = await connection.createChannel();

        channel.consume('reset password', data => {
            if(data !== null) {
                let options = JSON.parse(data.content.toString());
                options.from = config.username;
                
                const transporter = mailer.createTransport({
                    service : process.env.service,
                    port : 587,
                    secure : false,
                    requireTLS : true,
                    auth : {
                        user : config.username,
                        pass : config.password
                    },
                    logger : true
                });

                transporter.sendMail(options);
            }
        });
    } catch (error) {
        console.log(error);
    }
};

const consumeRSVP = async() => {
    const url = config.queue || 'amqp://localhost';
    let connection = await amqp.connect(url);
    let channel = await connection.createChannel();

    channel.consume('rsvp', data => {
        if(data !== null) {
            let options = JSON.parse(data.content.toString());
            options.from = config.username;
            
            const transporter = mailer.createTransport({
                service : process.env.service,
                port : 587,
                secure : false,
                requireTLS : true,
                auth : {
                    user : config.username,
                    pass : config.password
                },
                logger : true
            });

            transporter.sendMail(options);
        }
    });
}

const consumeReminder = async() => {
    const url = config.queue || 'amqp://localhost';
    let connection = await amqp.connect(url);
    let channel = await connection.createChannel();

    channel.consume('event reminder', data => {
        if(data !== null) {
            let options = JSON.parse(data.content.toString());
            options.from = config.username;

            const transporter = mailer.createTransport({
                service : process.env.service,
                port : 587,
                secure : false,
                requireTLS : true,
                auth : {
                    user : config.username,
                    pass : config.password
                },
                logger : true
            });
            transporter.sendMail(options);
        }
    })
}

try {
    consumeReminder();
    consumeResetPassword()
    consumeAccount();
    consumeRSVP();
} catch (error) {
    console.log('no messages to consume');
}


app.listen(config.port);