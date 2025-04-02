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
app.use(express.static(path.join(__dirname, "public")));

function isOrganization(req, res, next) {
  const token = req.cookies.authToken;

  if (!token) {
    res.redirect("/organization/signin");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ORG);
    req.organizationId = decoded.id; // Attach organization ID to the request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    res.redirect("/organization/signin");
  }
}

function isVolunteer(req, res, next) {
  const token = req.cookies.authToken;

  if (!token) {
    res.redirect("/volunteer/signin");
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_VOL);
    req.volunteerId = decoded.id; // Attach volunteer ID to the request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    res.redirect("/volunteer/signin");
  }
}

app.get("/", async (req, res) => {
  res.render("landingpage.ejs");
});

app.get("/logout", async (req, res) => {
  res.clearCookie("authToken");
  res.redirect("/");
});

app.get("/organization/signin", async (req, res) => {
  res.render("organization-signin");
});

app.get("/organization/signup", async (req, res) => {
  res.render("organization-signup");
});

app.get("/organization/task", isOrganization, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        orgId: req.organizationId,
      },
    });
    console.log(tasks);
    res.render("organization-task", { tasks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/organization/task/create", isOrganization, async (req, res) => {
  res.render("organization-create-task");
});

app.get("/organization/task/:taskId", isOrganization, async (req, res) => {
  const { taskId } = req.params;

  try {
    // Fetch the task from the database
    const task = await prisma.task.findUnique({
      where: { id: parseInt(taskId, 10) },
      include: { organization: true },
    });

    // Check if the task exists
    if (!task) {
      return res.status(404).send("Task not found");
    }

    // Verify that the organization accessing the task is the owner
    if (task.orgId !== req.organizationId) {
      return res.status(403).send("Unauthorized access");
    }

    // Pass the task information to the page
    res.render("organization-task-info", { task });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.get("/volunteer/signup", async (req, res) => {
  res.render("volunteer-signup");
});

app.get("/volunteer/signin", async (req, res) => {
  res.render("volunteer-signin");
});

app.get("/volunteer/dashboard", isVolunteer, async (req, res) => {
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

app.get("/volunteer/task", isVolunteer, async (req, res) => {
  const user = await prisma.volunteer.findFirst({
    where: { id: parseInt(req.volunteerId, 10) },
    include: { tasks: true },
  });

  res.render("volunteer-tasks", { tasks: user.tasks });
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
    const token = jwt.sign({ id: organization.id }, process.env.JWT_ORG, {
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
    // Check if the volunteer exists
    const volunteer = await prisma.volunteer.findUnique({
      where: { emailId },
    });

    if (!volunteer) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Compare the password
    const isPasswordValid = await bcrypt.compare(password, volunteer.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    // Generate a JWT token
    const token = jwt.sign({ id: volunteer.id }, process.env.JWT_VOL, {
      expiresIn: "1h",
    });

    // Store the token in a cookie
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    // Redirect to a volunteer dashboard or task page
    res.redirect("/volunteer/dashboard");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/volunteer/task/:taskId/register", isVolunteer, async (req, res) => {
  const { taskId } = req.params;

  try {
    // Fetch the task
    const task = await prisma.task.findUnique({
      where: { id: parseInt(taskId, 10) },
      include: { volunteers: true },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    console.log(task);
    if (
      task.size <= 0 ||
      (task.volunteers &&
        task.volunteers.some((volunteer) => volunteer.id === req.volunteerId))
    ) {
      return res.status(400).json({ error: "Cannot register in task" });
    }

    // Register the volunteer to the task
    // Add the volunteer to the task's volunteers relation
    await prisma.task.update({
      where: { id: task.id },
      data: {
        volunteers: {
          connect: { id: req.volunteerId },
        },
      },
    });

    // Decrease the size by 1
    await prisma.task.update({
      where: { id: task.id },
      data: { size: task.size - 1 },
    });

    res.redirect("/volunteer/dashboard"); // Redirect to the volunteer dashboard
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/organization/task/create", isOrganization, async (req, res) => {
  const { title, description, location, fromTime, toTime, size } = req.body;

  try {
    // Validate input fields
    if (!title || !description || !location || !fromTime || !toTime || !size) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (isNaN(size) || size <= 0) {
      return res.status(400).json({ error: "Size must be a positive number" });
    }

    // Ensure the organization is authenticated
    const orgId = req.organizationId;

    if (!orgId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Create the task
    const newTask = await prisma.task.create({
      data: {
        title,
        description,
        location,
        fromTime: new Date(fromTime),
        toTime: new Date(toTime),
        size: parseInt(size, 10),
        orgId,
      },
    });

    res.redirect("/organization/task"); // Redirect to the organization's task page
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/volunteer/task", isVolunteer, async (req, res) => {
  try {
    // Fetch tasks the volunteer has registered for
    const tasks = await prisma.task.findMany({
      where: {
        volunteers: {
          some: { id: req.volunteerId },
        },
      },
      include: { organization: true },
    });

    res.render("volunteer-tasks", { tasks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/volunteer/:volunteerId", async (req, res) => {
  const id = req.params.volunteerId;

  const volunteer = await prisma.volunteer.findUnique({
    where: {
      id: parseInt(id), // Replace volunteerId with the actual ID you want to search for
    },
  });

  if (!volunteer) res.status(500).json({ error: "no such user" });

  res.render("volunteer", { volunteer });
});

app.get("/organization/:organizationId", async (req, res) => {
  const id = req.params.organizationId;

  const organization = await prisma.organization.findUnique({
    where: {
      id: parseInt(id), // Replace volunteerId with the actual ID you want to search for
    },
  });

  if (!organization) res.status(500).json({ error: "no such user" });

  res.render("organization", { organization });
});

app.listen(3000);
