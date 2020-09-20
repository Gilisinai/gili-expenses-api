const User = require('../models/User')
const jwt = require('jsonwebtoken')
const expressJwt = require('express-jwt')
const _ = require('lodash')

const sgMail = require('@sendgrid/mail')
const { resetPasswordValidator } = require('../validators/auth')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

// exports.signup = async (req, res) => {

//     const {name, email, password} = req.body

//     let user = await User.findOne({email})

//     if(user) {
//         return res.status(400).json({
//             error: 'Email is taken'
//         })
//     }

//     let newUser = await User.create({
//         name,
//         email,
//         password
//     })

//     res.json({
//         message: 'Signup sucess! Please signin'
//     })
// }

exports.signup = (req, res) => {
    const { name, email, password } = req.body

    User.findOne({ email }).exec((err, user) => {
        if (user) {
            return res.status(400).json({
                error: 'Email is taken'
            })
        }

        const token = jwt.sign({ name, email, password }, process.env.JWT_ACCOUNT_ACTIVATION, { expiresIn: '15m' })

        const emailData = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: `Account activation link`,
            html: `
                <p>Please use the following link to activate your account</p>
                <p>${process.env.CLIENT_URL}/auth/activate/${token}</p>
                <hr/>
                <p>This email may contain sesitive information</p>
                <p>${process.env.CLIENT_URL}</p>
            `
        }

        sgMail.send(emailData).then(sent => {
            // console.log('Signup email sent')
            return res.json({
                message: `Email has been sent to ${email}. Follow the instructions to activate your account`
            })
        })
            .catch(err => {
                // console.log('Signup email sent error', err)
                return res.json({
                    message: err.message
                })
            })
    })
}

exports.accountActivation = (req, res) => {
    const { token } = req.body

    if (token) {
        jwt.verify(token, process.env.JWT_ACCOUNT_ACTIVATION, function (err, decoded) {
            if (err) {
                console.log('JWT VERIFY IN ACCOUNT ACTIVATION ERROR', err)
                return res.status(401).json({
                    error: 'Expired link. Signup again'
                })
            }

            const { name, email, password } = jwt.decode(token)

            const user = new User({ name, email, password })

            user.save((err, user) => {
                if (err) {
                    console.log('SAVE USER IN ACCOUNT ACTIVATION ERROR')
                    return res.status(401).json({
                        error: 'Error saving user in database. try aain'
                    })
                }
                return res.json({
                    message: 'Signip success. Please signin.'
                })
            })
        })
    } else {
        return res.json({
            message: 'Something went wrong'
        })
    }
}


exports.signin = (req, res) => {
    const { email, password } = req.body

    User.findOne({ email }).exec((err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'User with that email does not exist. Please signup'
            })
        }
        //authenticate
        if (!user.authenticate(password)) {
            return res.status(400).json({
                error: 'Email and password dont match'
            })
        }
        //generate a token and send to client
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
        const { _id, name, email, role } = user

        return res.json({
            token,
            user: { _id, name, email, role }
        })
    })

}

exports.requireSignin = expressJwt({
    secret: process.env.JWT_SECRET, algorithms: ['HS256']
})

exports.adminMiddleware = (req, res, next) => {
    User.findById({ _id: req.user._id }).exec((err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'User not found'
            })
        }

        if (user.role !== 'admin') {
            return res.status(400).json({
                error: 'Admin resource. access denied'
            })
        }

        req.profile = user
        next()
    })
}

exports.forgotPassword = (req, res) => {
    const { email } = req.body

    User.findOne({ email }, (err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'User with that email does not exist'
            })
        }


        const token = jwt.sign({ _id: user._id, name: user.name }, process.env.JWT_RESET_PASSWORD, { expiresIn: '15m' })

        const emailData = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: `Password reset link`,
            html: `
                <p>Please use the following link to reset your password</p>
                <p>${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
                <hr/>
                <p>This email may contain sesitive information</p>
                <p>${process.env.CLIENT_URL}</p>
            `
        }

        return user.updateOne({ resetPasswordLink: token }, (err, success) => {
            if (err) {
                console.log('reset password link error', err)
                return res.status(400).json({
                    error: 'Database connection error on user forgot password request'
                })
            } else {
                sgMail.send(emailData).then(sent => {
                    // console.log('Signup email sent')
                    return res.json({
                        message: `Email has been sent to ${email}. Follow the instructions to activate your account`
                    })
                })
                    .catch(err => {
                        // console.log('Signup email sent error', err)
                        return res.json({
                            message: err.message
                        })
                    })
            }
        })

    })
}

exports.resetPassword = (req, res) => {
    const { resetPasswordLink, newPassword } = req.body

    if (resetPasswordLink) {
        jwt.verify(resetPasswordLink, process.env.JWT_RESET_PASSWORD, (err, decoded) => {
            if (err) {
                return res.status(400).json({
                    error: 'Expired link. Try again'
                })
            }

            User.findOne({ resetPasswordLink }, (err, user) => {
                if (err || !user) {
                    return res.status(400).json({
                        error: 'Something went wrong. try later'
                    })
                }

                const updatedFields = {
                    password: newPassword,
                    resetPasswordLink: ''
                }

                user = _.extend(user, updatedFields)

                user.save((err, result) => {
                    if (err) {
                        return res.status(400).json({
                            error: 'Error resetting user password'
                        })
                    }
                    res.json({
                        message: `Great! now you can log in with your new password`
                    })
                })
            })
        })
    }
}