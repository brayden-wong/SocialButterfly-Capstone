import express from 'express'
import controller from '../controller/event';
import verify from '../middleware/verify';

const router = express.Router();

router.get('/events', controller.getEvents);
router.get('/search', controller.searchByTags);
router.get('/near', controller.nearMe);
router.get('/checklocation', controller.checkLocation);
router.post('/rsvp', verify.verify, controller.rsvp);
router.post('/validatelocation', controller.validateLocation);
router.post('/register', verify.verify, controller.registerEvent);
router.patch('/updateEvent', controller.updateEvent);
// router.get('/massimport', controller.massImport);

export = router;