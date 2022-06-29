import express from 'express';
import amqp from 'amqplib';
import mailer from 'nodemailer';
import config from './config/config';

const app = express();

const consumeAccount = async() => {
    const url = config.queue || 'amqp://localhost';
    const connection = await amqp.connect(url);
    const channel = connection.createChannel();

    (await channel).consume('register account', data => {
        if(data != null) {
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
}

consumeAccount();

app.listen(3001);