import axios, { AxiosResponse } from 'axios';

export async function request(url: string, method: string, params?: {}, data?: {}): Promise<AxiosResponse<any, any> | null> {
    if(url === null && method === null)
        return null;
    if(params !== undefined) {
        if(data !== undefined) {
            const response = await axios(url, {
                method : method,
                params : params,
                data :  data
            });
            return response;
        }
        const response = await axios(url, {
            method : method,
            params : params
        });
        return response;
    }
    if(data !== undefined) {
        const response = await axios(url, {
            method : method,
            data : data
        });
        return response;
    }
    const response = await axios(url, {
        method: method
    });
    return response;

}
