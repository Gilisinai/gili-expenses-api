const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
const connectDB = require('./config/db')
const path = require('path')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const dotenv = require('dotenv')



const app = express()

//connect to db
dotenv.config({path: './config/config.env'});

//connect to db
connectDB()

//import routes
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/user')



// app middleware
app.use(morgan('dev'))
app.use(bodyParser.json())

// app.use(cors()) // allows all origins

if(process.env.NODE_ENV = 'development') {
    app.use(cors({origin: `http://localhost:3000`}))
}


//middleware
app.use('/api', authRoutes)
app.use('/api', userRoutes)




const PORT = process.env.PORT || 8000

app.listen(PORT, () => {
    console.log(`server running on port ${PORT} - ${process.env.NODE_ENV} mode`)
})