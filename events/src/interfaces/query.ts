export default interface query {
    tags : string[],
    dates : Date[],
    city : string,
    radius : number
    online?: boolean
}