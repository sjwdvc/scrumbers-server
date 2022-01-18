const nodemailer = require('nodemailer');
/**
 * 
 * @returns {Promise<transport>}
 */
module.exports.getTransport = () => 
{
    return new Promise((resolve, reject) => {
        var transport = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: process.env.MAIL_PORT,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS
            }
        });
        transport.verify(function (error, success) {
            if (error)
                reject(error);
            else
                resolve(transport);
        });
    });
};