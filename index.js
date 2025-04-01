const express = require('express');
const { PrismaClient } = require('@prisma/client');

const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config()

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({extended: true}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/organization/signin', (req, res) => {
    res.render('ngo-signin');
});

app.get('/organization/signup', (req, res) => {
    res.render('ngo-signup');
});

app.post('/organization/signup', async (req, res) => {
    const {name, mobileNo, emailId, password} = req.body;

    try {
        // Validate mobile number, email, and password
        const mobileNoRegex = /^[0-9]{10}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!mobileNoRegex.test(mobileNo)) {
            return res.status(400).json({ error: 'Invalid mobile number format' });
        }

        if (!emailRegex.test(emailId)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        // Check if the organization already exists
        const existingOrg = await prisma.organization.findUnique({
            where: { emailId }
        });

        if (existingOrg) {
            return res.status(400).json({ error: 'Organization already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the organization
        const newOrg = await prisma.organization.create({
            data: {
                name,
                mobileNo,
                emailId,
                password: hashedPassword
            }
        });
        res.redirect('/organization/signin');
        //res.status(201).json({ message: 'Organization created successfully', organization: newOrg });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

app.listen(3000);