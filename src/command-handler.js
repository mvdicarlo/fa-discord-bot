const request = require('request');
const FileCookieStore = require('tough-cookie-filestore');
const cheerio = require('cheerio');
const logger = require('winston');

const cookieStore = new FileCookieStore('cookies.json');
const jar = request.jar(cookieStore);

const DEFAULT_URL = 'http://www.furaffinity.net';
const types = {
    'all': 1,
    'babyfur': 101,
    'bondage': 102,
    'digimon': 103,
    'fatfurs': 104,
    'fetishother': 105,
    'fursuit': 106,
    'gore': 119,
    'hyper': 107,
    'inflation': 108,
    'macro': 109,
    'muscle': 110,
    'mylittlepony': 111,
    'paw': 112,
    'pokemon': 113,
    'pregnancy': 114,
    'sonic': 115,
    'transformation': 116,
    'vore': 117,
    'watersports': 118,
    'general': 100,
};

request.defaults({
    jar
});

function checkStatus() {
    request.get({
        url: DEFAULT_URL,
        jar
    }, (err, res, body) => {
        if (err) {
            logger.log('error', 'Cookies are invalid', err);
        } else {
            if (!body.includes('Log Out')) {
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

function getPostPage(url, form) {
    return new Promise((resolve, reject) => {
        request.post(url, { jar, form }, (err, res, body) => {
            if (err) {
                reject(false);
            } else {
                resolve(body);
            }
        });
    });
}

function getRandomImageThumbnailFromPage(page) {
    const $ = cheerio.load(body);

    const links = [];
    $('img').each((im, el) => {
        if (el.name === 'img' && el.attribs.src && el.attribs.src.includes('facdn')) {
            links.push(el.attribs.src);
        }
    });

    return 'http:' + links[Math.floor(Math.random() * links.length)];
}

function getRandomFullImageFromPage(page) {
    return new Promise((resolve ,reject) => {
        const links = [];
        const $ = cheerio.load(page);
        $('a').each((im, el) => {
            if (el.name === 'a' && el.attribs.href && el.attribs.href.includes('/view/')) {
                links.push(el.attribs.href);
            }
        });

        getPage(DEFAULT_URL + links[Math.floor(Math.random() * links.length)])
        .then((body) => {
            const $ = cheerio.load(body);
            const img = $('img[id="submissionImg"]').eq(0).attr('data-fullview-src');
            resolve(`http:${img}`);
        }).catch((err) => {
            reject(err);
        });
    });
}

module.exports = {
    browse(type, nsfw, cb) {
        if (!types.hasOwnProperty(type)) {
            cb(`Invalid type: ${type}.\nTry using one of these <all |babyfur | bondage | digimon | fatfurs | fetishother | fursuit | gore | hyper | inflation | macro | mylittlepony | paw | pokemon | pregnancy | sonic | transformation | vore | watersports | general>`);
            return;
        }

        getPostPage(`${DEFAULT_URL}/browse/`, {
            atype: types[type],
            cat: 1,
            gender: 0,
            go: 'Update',
            perpage: 72,
            species: 1,
            rating_general: 1,
            rating_mature: nsfw ? 1 : 0,
            rating_adult: nsfw ? 1 : 0
        }).then((body) => {
            getRandomFullImageFromPage(body).then((img) => {
                cb(null, img);
            }).catch((err) => {
                cb('Unable to retrieve submission.');
            });
        }).catch((err) => {
            cb('Unable to retrieve submission.');
        });
    },

    frontPage(cb) {
        getPage(`${DEFAULT_URL}/browse`)
        .then((body) => {
            try {
                getRandomFullImageFromPage(body).then((img) => {
                    cb(null, img);
                }).catch((err) => {
                    cb('Unable to retrieve image.');
                });
            } catch (e) {
                cb('Unable to retrieve image.');
                logger.error(e.toString());
            }
        }).catch((err) => {
            cb('Unable to retrieve image.');
        });
    },

    randomImage(username, cb) {
        request.get({
            url: `${DEFAULT_URL}/user/${username}/`,
            jar
        }, (err, res, body) => {
            if (err) {
                cb(`Unable to retrieve user gallery for ${username}`, null);
            } else {
                if (body.includes('This user cannot be found.')) {
                    cb(`Unable to retrieve user gallery for ${username}`, null);
                    return;
                }

                const $ = cheerio.load(body);
                const submissionsCount = $('td').eq(16).text().split('\n')[2].trim().split(' ')[1].trim();
                const pageCount = Math.ceil(Number(submissionsCount) / 48);

                if (pageCount === 0 || pageCount === undefined) {
                    cb(null, `${username} has no submissions.`);
                } else {
                  getPage(`${DEFAULT_URL}/gallery/${username}/${Math.floor(Math.random() * pageCount)}/`).then(p => {
                    getRandomFullImageFromPage(p).then((img) => {
                        cb(null, img);
                    }).catch((err) => {
                        cb('Unable to retrieve image.');
                    });
                  }).catch(() => {
                    cb('Unable to retrieve image.');
                  })
                }
            }
        });
    },

    randomFavorite(username, cb) {
        getPage(`${DEFAULT_URL}/favorites/${username}`)
        .then(page => {
            getRandomFullImageFromPage(page)
            .then((img) => cb(null, img))
            .catch(() => cb('Unable to retrieve image.'));
        }).catch(() => cb('Unable to retrieve image.'));
    },

    tagSearch(tags, nsfw, cb) {
        const defaults = {
            page: 1,
            perpage: 48,
            q: tags.join('+'),
            mode: 'extended',
            'order-by': 'relevancy',
            'order-direction': 'desc',
            range: 'all',
            'rating-general': 'on',
            'type-art': 'on',
            'type-flash': 'on',
            'type-music': 'on',
            'type-photo': 'on'
        };

        if (nsfw) {
            defaults['rating-mature'] = 'on';
            defaults['rating-adult'] = 'on';
        }

        request.post(`${DEFAULT_URL}/search/`, {
            jar,
            form: defaults
        }, (err, res, body) => {
            if (err) {
                cb('Unable to perform search.');
            } else {
                try {
                    const maxQuerySize = 3000; // this is a limit I believe exists on the website
                    const shownPerPage = 48;
                    const $ = cheerio.load(body);
                    const submissionCount = Number($('legend').eq(6).text().split(' ')[6].replace(/(,|\))/g, ''));

                    if (submissionCount > 0 && !isNaN(submissionCount)) {
                        defaults.page = Math.ceil(Math.random() * Math.ceil(submissionCount / shownPerPage));
                        getPostPage(`${DEFAULT_URL}/search/`, defaults)
                        .then((searchPage) => {
                            getRandomFullImageFromPage(searchPage).then((img) => {
                                cb(null, img);
                            }).catch((e) => {
                                cb('Unable to find submission.');
                            });
                        }).catch((e) => {
                            logger.error(e.toString());
                        });
                    } else {
                        cb(null, `No submissions found for ${tags.join(' ')}`);
                    }
                } catch (e) {
                    cb('Unable to perform search.');
                    logger.error(e.toString());
                }
            }
        });
    },

    userStats(username, cb) {
        getPage(`${DEFAULT_URL}/user/${username}`)
        .then((userPage) => {
            try {
                const $ = cheerio.load(userPage);
                const tdBlocks = $('td');
                const infoBlock = tdBlocks.eq('12').text().split('\n').map(str => str.trim()).filter(str => str !== '' && str !== '\n');
                const statsBlock = tdBlocks.eq('16').text().split('\n').map(str => str.trim()).filter(str => str !== '' && str !== '\n');
                const watchedBlock = tdBlocks.eq('42').text().split(' ').filter(str => str !== '' && str !== '\n');
                const watchingBlock = tdBlocks.eq('57').text().split(' ').filter(str => str !== '' && str !== '\n');

                const userTitle = infoBlock[1].split(': ')[1];
                const registeredSince = infoBlock[2].split(': ')[1];
                const currentMood = infoBlock[3].split(': ')[1];

                const pageVisits = statsBlock[0].split(': ')[1];
                const submissions = statsBlock[1].split(': ')[1];
                const commentsReceived = statsBlock[2].split(': ')[1];
                const commentsGiven = statsBlock[3].split(': ')[1];
                const journals = statsBlock[4].split(': ')[1];
                const favorites = statsBlock[5].split(': ')[1];

                const watching = watchingBlock[2].replace(/(\(|\))/g, '');
                const watchedBy = watchedBlock[2].replace(/(\(|\))/g, '');

                const msg =
                    '```' +
                    `User: ${username}\n` +
                    `Title: ${userTitle}\n` +
                    `Registered: ${registeredSince}\n` +
                    `Current Mood: ${currentMood}\n` +
                    '\n' +
                    `Comments Given: ${commentsGiven}\n` +
                    `Comments Received: ${commentsReceived}\n` +
                    `Favorites: ${favorites}\n` +
                    `Journals: ${journals}\n` +
                    `Page Visits: ${pageVisits}\n` +
                    `Submissions: ${submissions}\n` +
                    '\n' +
                    `Watching: ${watching}\n` +
                    `Watchers: ${watchedBy}` +
                    '```';

                    cb(null, msg);
            } catch (e) {
                cb(`Unable to retrieve stats for ${username}.`);
                logger.error(e.toString());
            }
        }).catch((err) => {
            cb(`Unable to retrieve stats for ${username}.`);
        });
    }
}
