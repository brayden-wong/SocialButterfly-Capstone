"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const amqplib_1 = __importDefault(require("amqplib"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = __importDefault(require("./config/config"));
const app = (0, express_1.default)();
const consumeAccount = () => __awaiter(void 0, void 0, void 0, function* () {
    const url = config_1.default.queue || 'amqp://localhost';
    const connection = yield amqplib_1.default.connect(url);
    const channel = connection.createChannel();
    (yield channel).consume('register account', data => {
        if (data != null) {
            let options = JSON.parse(data.content.toString());
            options.from = config_1.default.username;
            const service = process.env.service || 'gmail';
            const transporter = nodemailer_1.default.createTransport({
                service: service,
                port: 587,
                secure: false,
                requireTLS: true,
                auth: {
                    user: config_1.default.username,
                    pass: config_1.default.password,
                },
                logger: true
            });
            transporter.sendMail(options);
        }
    });
});
consumeAccount();
app.listen(3001);
