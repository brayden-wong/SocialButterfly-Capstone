import dotenv from 'dotenv';
import path from 'path';
dotenv.config({path : path.resolve(__dirname, '.env.config')});

export default { 
    username : process.env.username,
    password : process.env.password,
    queue : process.env.queue,
    port : process.env.port
};