import express from 'express';
import controller from '../controller/user';
import verify from '../middleware/verify';

const router = express.Router();

router.get('/verify', controller.verifyAccount);
router.get('/getUser', controller.getUser);
router.get('/getAllUsers', verify.verify, controller.getAllUsers);
router.post('/login', controller.login);
router.post('/register', controller.register);
router.post('/resetPassword', controller.resetPassword);
router.patch('/reset', controller.reset);
router.patch('/update', controller.updateUserInformation);
router.patch('/follow', verify.verify, controller.addUser);
router.patch('/unfollow', verify.verify, controller.removeUser);

export = router;