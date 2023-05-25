const https = require('https');
const template = require('es6-template-strings');
const path = require('path')

const getURL = async (url)=>{
    return await new Promise((resolve, reject)=>{
        const request = https.request(url, async (response) => {
            if(response.statusCode === 301 || response.statusCode === 302) {
              return await getURL(response.headers.location);
            }
            let data = '';
            response.on('data', (chunk) => {
                data = data + chunk.toString();
            });
          
            response.on('end', () => {
                const body = JSON.parse(data);
                resolve(body);
            });
        })
          
        request.on('error', (error) => {
            reject(error);
        });
          
        request.end() 
    });
}

const getURLFrom = async (opts, endpoints)=>{
    const options = typeof opts === 'string'?{ name : opts }:opts;
    if(!options.version) options.version = '';
    let result = null;
    let location = null;
    let packageInfo = null;
    let body = null;
    const keys = Object.keys(endpoints);
    for(let lcv=0; lcv < keys.length; lcv++){
        location = template(endpoints[keys[lcv]], options);
        packageInfo = require(template('${name}/package.json', options));
        console.log('**', packageInfo);
        body = await getURL(location+packageInfo.main);
        console.log('???', location);
    }
    return result;
    
}


module.exports = {
    createImportMap : async (deps, endpoints)=>{
        console.log('>>', deps, endpoints)
        return await Object.keys(deps).reduce(async (agg, key)=>{
            agg[key] = getURLFrom(key, endpoints);
            return agg;
        }, {})
    }
}