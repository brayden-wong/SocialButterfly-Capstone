import express, { Request, Response } from 'express';
import registerService from './helper/eureka.connection';
import mailer from 'nodemailer';
import cors from 'cors';
import config from './config/config';

const app = express();

setTimeout(() => {
    registerService.registerService('consumer', Number.parseInt(String(config.port)));
}, 15000);

app.use(express.urlencoded({ extended: true}));
app.use(express.json());

interface options {
    from: string;
    to: string;
    subject: string;
    html: string;
}

app.use(cors());
const sendEmail = (data: options) => {
    if(data === null)
        return;
    let option = data;    
    option.from = String(config.username);
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
    transporter.sendMail(option);
}

app.post('/sendmail', async (req: Request, res: Response) => {
    console.log(req.body);
    console.log('I\'m on the brink of sucidie!');
    const option = req.body as options;
    sendEmail(option);
    return res.status(200).json('email sent');
});

app.get('/liveness', (req, res) => {
    return res.sendStatus(200);
});

app.listen(config.port);
