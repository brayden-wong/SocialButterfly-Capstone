import express from 'express';
import controller from '../controller/user';
import verify from '../middleware/verify';
// import database from '../database/user';

const router = express.Router();

// router.get('/users', database.getUsers);
router.get('/verify', controller.verifyAccount);
router.get('/getUser', controller.getUser);
router.get('/users', controller.getAllUsers);
router.get('/user-by-email', controller.userByEmail);
router.post('/login', controller.login);
router.post('/register', controller.register);
router.post('/reset', controller.resetPassword);
router.patch('/reset', controller.reset);
router.patch('/update', controller.updateUserInformation);
router.patch('/follow', verify.verify, controller.addUser);
router.patch('/unfollow', verify.verify, controller.removeUser);

export = router;