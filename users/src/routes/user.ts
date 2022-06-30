import express from 'express';
import controller from '../controller/user';

const router = express.Router();

router.get('/verify', controller.verifyAccount);
router.get('/getAllUsers', controller.getAllUsers);
router.post('/login', controller.login);
router.post('/register', controller.register);
router.post('/resetPassword', controller.resetPassword);
router.patch('/reset', controller.reset);
router.patch('/update', controller.updateUserInformation);

export = router;