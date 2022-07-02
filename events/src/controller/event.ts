import { Response, Request, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import Event from '../interface/event';
import axios from 'axios';
import config from '../config/config';
import database from '../database/event';


const registerEvent = async(req : Request, res : Response): Promise<Response> => {
    let event: Event = {
        _id : new ObjectId(),
        event_name : req.body.event_name,
        date : null,
        tags : req.body.tags,
        formatted_address : req.body.address,
        location : {
            point : 'type',
            coordinates : [null]
        },
        city : req.body.city,
        rsvp : 0,
        available_slots : req.body.available_slots,
        organizations : req.body.organizations,
        online : req.body.online
    };
    
    const checkParameters = (event : Event) => {
        Object.values(event).every(value => {
            if(value === undefined) return true;
        });
        return false;
    }

    if(checkParameters(event))
        res.status(401).json('one or many fields are undefined');
    if(await database.checkLocation(event.city)) {
        
    }
    return res.status(200).json(event);
}

export default { registerEvent }