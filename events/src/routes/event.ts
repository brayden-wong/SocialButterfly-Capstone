import express from 'express'
import controller from '../controller/event';

const router = express.Router();

router.post('/register', controller.registerEvent);

export = router;