import { Response, Request, NextFunction } from 'express';
import { Double, ObjectId } from 'mongodb';
import Event from '../interface/event';
import axios from 'axios';
import config from '../config/config';
import database from '../database/event';


const registerEvent = async(req : Request, res : Response): Promise<Response> => {
    let event: Event = {
        _id : new ObjectId(),
        event_name : req.body.event_name,
        date : new Date(),
        tags : req.body.tags,
        formatted_address : req.body.address,
        location : {
            type : 'point',
            coordinates : []
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
    if(await database.checkLocation(/*event.city*/'hello')) {
        /*
            After this if statement you need to check to see if there are similar 
            events like this happening in the area
        */
    } else {
        await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address : event.formatted_address,
                key : config.server.google_api_key
            }
        })
            .then(response => {
                const city = response.data.results[0].address_components.filter((address: { types: string | string[]; }) => address.types.includes('locality'))[0].long_name;
                event.city = city;

                event.location.coordinates.push(response.data.results[0].geometry.location.lng);
                event.location.coordinates.push(response.data.results[0].geometry.location.lat);

                database.insertEvent(event);
            });
        console.log(event);
    }
    return res.status(200).json(event);
}

export default { registerEvent }