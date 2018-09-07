const request = require('request');
const FileCookieStore = require('tough-cookie-filestore');
const cheerio = require('cheerio');
const logger = require('winston');

const cookieStore = new FileCookieStore('cookies.json');
const jar = request.jar(cookieStore);

request.defaults({
    jar
});

function checkStatus() {
    request.get({
        url: 'http://www.furaffinity.net',
        jar
    }, (err, res, body) => {
        if (err) {
            logger.log('error', 'Cookies are invalid', err);
        } else {
            if (body.includes('Log Out')) {
                logger.info('Cookies still valid.');
            } else {
                logger.error('Unable to verify cookies.');
            }
        }
    });
}

setInterval(checkStatus, 60 * 60000);
checkStatus();

function getPage(url) {
    return new Promise((resolve, reject) => {
        request.get({
            url,
            jar
        }, (err, res, body) => {
            if (err) {
                reject(false);
            } else {
                resolve(body);
            }
        });
    })
}

module.exports = {
    randomImage(username, cb) {
        request.get({
            url: `http://www.furaffinity.net/user/${username}/`,
            jar
        }, (err, res, body) => {
            if (err) {
                cb(`Unable to retrieve user gallery for ${username}`, null);
            } else {
                const $ = cheerio.load(body);
                const submissionsCount = $('td').eq(16).text().split('\n')[2].trim().split(' ')[1].trim();
                const pageCount = Math.ceil(Number(submissionsCount) / 48);
                
                const promises = [];
                promises.push(getPage(`http://www.furaffinity.net/gallery/${username}/${Math.floor(Math.random() * pageCount)}/`))

                Promise.all(promises).catch(err => {
                    cb(`Unable to retrieve user gallery for ${username}`, null);
                }).then(pages => {
                    const links = [];
                    const images = pages.map(p => {
                        const $ = cheerio.load(p);
                        $('a').each((im, el) => {
                            if (el.name === 'a' && el.attribs.href && el.attribs.href.includes('/view/')) {
                                links.push(el.attribs.href);
                            }
                        });
                    });

                    const link = 'http://www.furaffinity.net' + links[Math.floor(Math.random() * links.length)];

                    cb(null, link);
                });
            }
        });
    }
}
