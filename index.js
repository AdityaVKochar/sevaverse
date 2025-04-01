const express = require("express");
const { PrismaClient } = require("@prisma/client");

const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config();

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

function isOrganization(req, res, next) {
  const token = req.cookies.authToken;

  if (!token) {
    res.redirect("/organization/signin");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.organizationId = decoded.id; // Attach organization ID to the request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    res.redirect("/organization/signin");
  }
}

app.get("/organization/signin", async (req, res) => {
  res.render("organization-signin");
});

app.get("/organization/signup", async (req, res) => {
  res.render("organization-signup");
});

app.get("/organization/task", isOrganization, async (req, res) => {
  console.log(req);
  res.render("organization-task");
});
app.get("/volunteer/signup", async (req, res) => {
  res.render("volunteer-signup");
});
app.get("/volunteer/signin", async (req, res) => {
  res.render("volunteer-signin");
});
app.get("/", async (req, res) => {
  res.render("landingpage");
});

app.post("/organization/signup", async (req, res) => {
  const { name, mobileNo, emailId, password } = req.body;

  try {
    // Validate mobile number, email, and password
    const mobileNoRegex = /^[0-9]{10}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!mobileNoRegex.test(mobileNo)) {
      return res.status(400).json({ error: "Invalid mobile number format" });
    }

    if (!emailRegex.test(emailId)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters long" });
    }

    // Check if the organization already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { emailId },
    });

    if (existingOrg) {
      return res.status(400).json({ error: "Organization already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the organization
    const newOrg = await prisma.organization.create({
      data: {
        name,
        mobileNo,
        emailId,
        password: hashedPassword,
      },
    });
    res.redirect("/organization/signin");
    //res.status(201).json({ message: 'Organization created successfully', organization: newOrg });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/organization/signin", async (req, res) => {
  const { emailId, password } = req.body;

  try {
    // Check if the organization exists
    const organization = await prisma.organization.findUnique({
      where: { emailId },
    });

    if (!organization) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Compare the password
    const isPasswordValid = await bcrypt.compare(
      password,
      organization.password
    );

    if (!isPasswordValid) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Generate a JWT token
    const token = jwt.sign({ id: organization.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Store the token in a cookie
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    res.redirect("/organization/task");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/volunteer/signup", async (req, res) => {
  const { name, dob, age, gender, mobileNo, emailId, city, password } =
    req.body;

  try {
    // Validate input fields
    const mobileNoRegex = /^[0-9]{10}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!mobileNoRegex.test(mobileNo)) {
      return res.status(400).json({ error: "Invalid mobile number format" });
    }

    if (!emailRegex.test(emailId)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters long" });
    }

    // Check if the volunteer already exists
    const existingVolunteer = await prisma.volunteer.findUnique({
      where: { emailId },
    });

    if (existingVolunteer) {
      return res.status(400).json({ error: "Volunteer already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the volunteer
    const newVolunteer = await prisma.volunteer.create({
      data: {
        name,
        dob: new Date(dob), // Convert dob to Date object
        age: parseInt(age, 10),
        gender,
        mobileNo,
        emailId,
        city,
        password: hashedPassword,
      },
    });

    // Redirect to the volunteer sign-in page
    res.redirect("/volunteer/signin");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/volunteer/signin", async (req, res) => {
  const { emailId, password } = req.body;

  try {
    console.log("Sign-in request received for:", emailId);

    // Check if the volunteer exists
    const volunteer = await prisma.volunteer.findUnique({
      where: { emailId },
    });

    if (!volunteer) {
      console.log("Volunteer not found");
      return res.status(400).json({ error: "Invalid email or password" });
    }

    console.log("Volunteer found:", volunteer);

    // Compare the password
    const isPasswordValid = await bcrypt.compare(password, volunteer.password);

    if (!isPasswordValid) {
      console.log("Invalid password");
      return res.status(400).json({ error: "Invalid email or password" });
    }

    console.log("Password is valid");

    // Generate a JWT token
    const token = jwt.sign({ id: volunteer.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    console.log("JWT token generated:", token);

    // Store the token in a cookie
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    console.log("Token stored in cookie");

    // Redirect to the volunteer dashboard
    res.status(302).redirect("/volunteer/dashboard");
  } catch (error) {
    console.error("Error during sign-in:", error);
    res.status(302).redirect("/volunteer/dashboard");
    res.status(500).json({ error: "Internal server error" });
  }
});
app.get("/volunteer/dashboard", async (req, res) => {
  try {
    const currentDate = new Date();

    const tasks = await prisma.task.findMany({
      where: {
        fromTime: { gte: currentDate },
      },
      include: { organization: true },
    });

    console.log("Fetched tasks:", tasks); // Debugging

    res.render("volunteer-dashboard", { tasks });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/volunteer/task/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch task details by ID
    const task = await prisma.task.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        organization: true, // Include organization details
      },
    });

    if (!task) {
      return res.status(404).send("Task not found");
    }

    // Render the task details page
    res.render("volunteer-task", { task });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/logout", (req, res) => {
  res.clearCookie("token"); // Clear the authentication token
  res.redirect("/"); // Redirect to the landing page
});

app.listen(3000);
