const nodemailer = require("nodemailer");

const {host, service, port, user, pass } = require('../../config/mail')
const sendEmail = async (email, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      host: host,
      service: service,
      port: port,
      secure: true,
      auth: {
        user: user,
        pass: pass,
      },
    });

    await transporter.sendMail({
      from: user,
      to: email,
      subject: subject,
      text: text,
    });
   return true
  } catch (e) {
    return false
  }
};

module.exports = sendEmail;