import express from 'express'
import controller from '../controller/event';
import verify from '../middleware/verify';

const router = express.Router();

// router.post('/register', verify.verify, controller.registerEvent);
router.get('/events', controller.getEvents);
router.get('/search', controller.searchByTags);
router.get('/rsvp', verify.verify, controller.rsvp);

export = router;