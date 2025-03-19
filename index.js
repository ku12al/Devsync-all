require("dotenv").config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const { Octokit } = require("@octokit/rest");
const User = require("./models/User");
const Repo = require("./models/Repo");
const MongoStore = require("connect-mongo");
const PORT = process.env.PORT || 5500;

const app = express();

// DevSync program start date - all contributions are tracked from this date
const PROGRAM_START_DATE = "2025-03-14";

// Create authenticated Octokit instance
const octokit = new Octokit({
  auth: process.env.GITHUB_ACCESS_TOKEN,
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Calculate points based on contributions from registered repos
async function calculatePoints(mergedPRs, userId) {
  try {
    let totalPoints = 0;

    // Calculate points for merged PRs only
    for (const pr of mergedPRs) {
      const repo = await Repo.findOne({ repoLink: pr.repoId });
      if (repo) {
        // Skip points if user is the maintainer
        if (repo.userId === userId) {
          continue;
        }
        totalPoints += repo.successPoints || 50;
      }
    }

    return totalPoints;
  } catch (error) {
    console.error("Error calculating points:", error);
    return 0;
  }
}

// Check and assign badges based on valid contributions
async function checkBadges(mergedPRs, points) {
  try {
    const registeredRepos = await Repo.find({}, "repoLink");
    const registeredRepoIds = registeredRepos.map((repo) => repo.repoLink);
    const validMergedPRsCount = mergedPRs.filter((pr) =>
      registeredRepoIds.includes(pr.repoId)
    ).length;

    const badges = ["Newcomer"];
    if (validMergedPRsCount >= 1) badges.push("First Contribution");
    if (validMergedPRsCount >= 5) badges.push("Active Contributor");
    if (validMergedPRsCount >= 10) badges.push("Super Contributor");
    if (points >= 100) badges.push("Point Master");
    if (points >= 500) badges.push("DevSync Champion");

    return badges;
  } catch (error) {
    console.error("Error checking badges:", error);
    return ["Newcomer"];
  }
}

// Update user data when PRs are merged or cancelled
async function updateUserPRStatus(userId, repoId, prData, status) {
  try {
    const user = await User.findOne({ githubId: userId });
    if (!user) return;

    if (status === "merged") {
      user.mergedPRs.push({
        repoId,
        prNumber: prData.number,
        title: prData.title,
        mergedAt: new Date(),
      });
    }

    user.points = await calculatePoints(user.mergedPRs, user.githubId);
    user.badges = await checkBadges(user.mergedPRs, user.points);

    await user.save();
  } catch (error) {
    console.error("Error updating user PR status:", error);
  }
}

// Middleware setup
app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));
app.use(
  cors({
    origin: ["https://sayan-dev731.github.io/devsync-opensource", "http://127.0.0.1:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_session_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
      ttl: 24 * 60 * 60, // Session TTL in seconds (1 day)
      autoRemove: "native", // Enable automatic removal of expired sessions
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    },
    name: "devsync.sid", // Custom session cookie name
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ githubId: profile.id });

        if (!user) {
          user = await User.create({
            githubId: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            email: profile.emails?.[0]?.value || "",
            avatarUrl: profile.photos?.[0]?.value || "",
            mergedPRs: [],
            cancelledPRs: [],
            points: 0,
            badges: ["Newcomer"],
          });
        }

        return done(null, { ...profile, userData: user });
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Auth routes
app.get("/auth/github", passport.authenticate("github", 
    {
    
     scope: ["user"] 
    
    }));

app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect(process.env.FRONTEND_URL);
  }
);

app.get("/api/user", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      isAuthenticated: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName,
        photos: req.user.photos,
      },
    });
  } else {
    res.json({ isAuthenticated: false });
  }
});

app.get("/api/user/stats", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const user = await User.findOne({ githubId: req.user.id });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      mergedPRs: user.mergedPRs,
      cancelledPRs: user.cancelledPRs,
      points: user.points,
      badges: user.badges,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user stats" });
  }
});

// Add helper function to calculate trends
async function calculateTrends(users) {
  try {
    // Get previous rankings from 24 hours ago
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oldRankings = await User.find(
      { "mergedPRs.mergedAt": { $lt: oneDayAgo } },
      "username points"
    ).lean();

    // Sort old rankings by points
    const oldRanked = oldRankings.sort((a, b) => b.points - a.points);
    const oldRankMap = new Map(
      oldRanked.map((user, index) => [user.username, index + 1])
    );

    // Sort current users by points
    const currentRanked = users.sort((a, b) => b.points - a.points);

    // Calculate trend for each user
    return currentRanked.map((user, currentRank) => {
      const oldRank = oldRankMap.get(user.username) || currentRank + 1;
      const rankChange = oldRank - (currentRank + 1);
      const trend =
        oldRank !== 0 ? Math.round((rankChange / oldRank) * 100) : 0;
      return {
        ...user,
        trend,
      };
    });
  } catch (error) {
    console.error("Error calculating trends:", error);
    return users.map((user) => ({ ...user, trend: 0 }));
  }
}

// Update leaderboard endpoint
app.get("/api/leaderboard", async (req, res) => {
  try {
    // Add cache control headers
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    const users = await User.find({})
      .select("username points badges mergedPRs")
      .lean();

    // Format user data with required fields only
    let formattedUsers = users.map((user) => ({
      username: user.username,
      points: user.points || 0,
      mergedPRs: (user.mergedPRs || []).map((pr) => ({
        title: pr.title,
        mergedAt: pr.mergedAt,
      })),
      badges: user.badges || ["Newcomer"],
      trend: 0,
    }));

    // Calculate and add trends
    formattedUsers = await calculateTrends(formattedUsers);

    // Sort by points and add ranks
    formattedUsers.sort((a, b) => b.points - a.points);
    formattedUsers = formattedUsers.map((user, index) => ({
      ...user,
      rank: index + 1,
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// Add global stats endpoint
app.get("/api/stats/global", async (req, res) => {
  try {
    // Get all users and accepted repos
    const [users, acceptedRepos] = await Promise.all([
      User.find({}),
      Repo.find({ reviewStatus: "accepted" }),
    ]);

    // Calculate total merged PRs
    const totalMergedPRs = users.reduce(
      (total, user) => total + user.mergedPRs.length,
      0
    );

    // Count active users (users with at least 1 merged PR)
    const activeUsers = users.filter(
      (user) => user.mergedPRs.length > 0
    ).length;

    // Count registered repos
    const registeredRepos = acceptedRepos.length;

    res.json({
      totalMergedPRs,
      activeUsers,
      registeredRepos,
    });
  } catch (error) {
    console.error("Error fetching global stats:", error);
    res.status(500).json({ error: "Failed to fetch global stats" });
  }
});

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("http://localhost:3000/index.html");
});

// Update GitHub API routes with Octokit
app.get("/api/github/user/:username", async (req, res) => {
  try {
    const { data: userData } = await octokit.users.getByUsername({
      username: req.params.username,
    });

    // Get user's contributions using GraphQL API
    const { data: contributionsData } = await octokit.graphql(
      `
            query($username: String!) {
                user(login: $username) {
                    contributionsCollection {
                        totalCommitContributions
                    }
                }
            }
        `,
      { username: req.params.username }
    );

    res.json({
      ...userData,
      contributions:
        contributionsData.user.contributionsCollection.totalCommitContributions,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch GitHub data" });
  }
});

app.get("/api/github/contributions/:username", async (req, res) => {
  try {
    const response = await fetch(
      `https://github-contributions-api.now.sh/v1/${req.params.username}`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contribution data" });
  }
});

// Add this helper function near other helpers
async function normalizeAndValidateGitHubUrl(url) {
  try {
    // Handle URLs without protocol
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    const urlObj = new URL(url);
    if (!urlObj.hostname.toLowerCase().endsWith("github.com")) {
      throw new Error("Not a GitHub repository URL");
    }

    // Clean and split path
    const cleanPath = urlObj.pathname
      .toLowerCase() // Convert to lowercase
      .replace(/\.git$/, "") // Remove .git suffix
      .replace(/\/$/, "") // Remove trailing slash
      .split("/")
      .filter(Boolean); // Remove empty parts

    if (cleanPath.length < 2) {
      throw new Error("Invalid repository URL format");
    }

    const [owner, repo] = cleanPath;

    // Verify repo exists and is public using Octokit
    try {
      const { data: repoData } = await octokit.repos.get({
        owner,
        repo,
      });

      if (repoData.private) {
        throw new Error("Private repositories are not allowed");
      }

      // Return canonical URL format using actual case from GitHub API
      return `https://github.com/${repoData.owner.login}/${repoData.name}`;
    } catch (error) {
      if (error.status === 404) {
        throw new Error("Repository not found");
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Invalid URL format");
    }
    throw error;
  }
}

// Update the project submission route
app.post("/api/projects", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    let { repoLink, ownerName, technology, description } = req.body;

    if (!repoLink || !ownerName || !technology || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Normalize and validate repository URL
    try {
      repoLink = await normalizeAndValidateGitHubUrl(repoLink);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    // Case-insensitive check for duplicate repository using normalized URL
    const existingProject = await Repo.findOne({
      repoLink: {
        $regex: new RegExp(
          `^${repoLink.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}$`,
          "i"
        ),
      },
    });

    if (existingProject) {
      return res.status(400).json({
        error: "This repository has already been submitted",
        status: existingProject.reviewStatus,
        submitDate: existingProject.submittedAt,
        submittedBy: existingProject.ownerName,
      });
    }

    // Create project with normalized URL
    const projectData = {
      repoLink,
      ownerName,
      technology,
      description,
      userId: req.user.id,
      submittedAt: new Date(),
    };

    const project = await Repo.create(projectData);
    res.status(200).json({ success: true, project });
  } catch (error) {
    console.error("Error saving project:", error);
    res.status(500).json({ error: "Failed to save project" });
  }
});

// Delete project route
app.delete("/api/projects/:projectId", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const project = await Repo.findById(req.params.projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if user is admin
    const adminIds = process.env.ADMIN_GITHUB_IDS.split(",");
    const isAdmin = adminIds.includes(req.user.username);

    // Allow deletion if user owns the project OR is an admin
    if (project.userId.toString() !== req.user.id && !isAdmin) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this project" });
    }

    await Repo.findByIdAndDelete(req.params.projectId);
    res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// Get all accepted projects
app.get("/api/accepted-projects", async (req, res) => {
  try {
    const projects = await Repo.find({ reviewStatus: "accepted" })
      .select(
        "repoLink ownerName technology description reviewStatus reviewedAt"
      )
      .sort({ submittedAt: -1 });
    res.json(projects);
  } catch (error) {
    console.error("Error fetching accepted projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// Get user's projects
app.get("/api/projects/:userId", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Verify the requested userId matches the authenticated user's id
    if (req.params.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const projects = await Repo.find({ userId: req.params.userId })
      .select(
        "repoLink ownerName technology description reviewStatus reviewedAt"
      )
      .sort({ submittedAt: -1 });
    res.json(projects);
  } catch (error) {
    console.error("Error fetching user projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// Admin verification endpoint
app.get("/api/admin/verify", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ isAdmin: false });
  }

  const adminIds = process.env.ADMIN_GITHUB_IDS.split(",");
  const isAdmin = adminIds.includes(req.user.username);

  res.json({ isAdmin });
});

// Admin projects endpoint
app.get("/api/admin/projects", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const adminIds = process.env.ADMIN_GITHUB_IDS.split(",");
  if (!adminIds.includes(req.user.username)) {
    return res.status(403).json({ error: "Not authorized" });
  }

  try {
    const allProjects = await Repo.find({}).sort({ submittedAt: -1 });
    res.json(allProjects);
  } catch (error) {
    console.error("Error fetching all projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// Add review project endpoint
app.post("/api/admin/projects/:projectId/review", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const adminIds = process.env.ADMIN_GITHUB_IDS.split(",");
  if (!adminIds.includes(req.user.username)) {
    return res.status(403).json({ error: "Not authorized" });
  }

  try {
    const { status } = req.body;
    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid review status" });
    }

    const project = await Repo.findByIdAndUpdate(
      req.params.projectId,
      {
        reviewStatus: status,
        reviewedAt: new Date(),
        reviewedBy: req.user.username,
      },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json(project);
  } catch (error) {
    console.error("Error reviewing project:", error);
    res.status(500).json({ error: "Failed to review project" });
  }
});

// Update points update endpoint
app.patch("/api/admin/projects/:projectId/points", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const adminIds = process.env.ADMIN_GITHUB_IDS.split(",");
  if (!adminIds.includes(req.user.username)) {
    return res.status(403).json({ error: "Not authorized" });
  }

  try {
    const { successPoints } = req.body;

    const project = await Repo.findByIdAndUpdate(
      req.params.projectId,
      {
        successPoints,
      },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json(project);
  } catch (error) {
    console.error("Error updating project points:", error);
    res.status(500).json({ error: "Failed to update project points" });
  }
});

// Helper function to check if repo is registered and accepted
async function isRegisteredRepo(repoFullName) {
  const repoUrl = `https://github.com/${repoFullName}`;
  const repo = await Repo.find({
    repoLink: repoUrl,
    reviewStatus: "accepted",
  });
  return repo ? repo : null;
}

// Helper function to fetch PR details using Octokit
async function fetchPRDetails(username) {
  try {
    const { data } = await octokit.search.issuesAndPullRequests({
      q: `type:pr+author:${username}+is:merged+created:>=${PROGRAM_START_DATE}`,
      per_page: 100,
    });

    return data;
  } catch (error) {
    console.error(`Error fetching PRs for ${username}:`, error);
    return { items: [] };
  }
}

// Update PR status check endpoint
app.get("/api/github/prs/update", async (req, res) => {
  try {
    const users = await User.find({});
    const results = [];

    const acceptedRepos = await Repo.find(
      {
        reviewStatus: "accepted",
      },
      "repoLink successPoints userId"
    );

    for (const user of users) {
      try {
        const prData = await fetchPRDetails(user.username);
        const mergedPRs = [];

        for (const pr of prData.items) {
          try {
            const [owner, repo] = pr.repository_url
              .split("/repos/")[1]
              .split("/");
            const repoUrl = `https://github.com/${owner}/${repo}`;

            const registeredRepo = acceptedRepos.find(
              (repo) => repo.repoLink === repoUrl
            );

            if (registeredRepo) {
              // Get detailed PR info using Octokit
              const { data: prDetails } = await octokit.pulls.get({
                owner,
                repo,
                pull_number: pr.number,
              });

              if (prDetails.merged) {
                mergedPRs.push({
                  repoId: repoUrl,
                  prNumber: pr.number,
                  title: pr.title,
                  mergedAt: prDetails.merged_at,
                });
              }
            }
          } catch (prError) {
            console.error(`Error processing PR ${pr.number}:`, prError);
            continue;
          }
        }

        // Update user's data
        user.mergedPRs = mergedPRs;
        user.points = await calculatePoints(mergedPRs, user.githubId);
        user.badges = await checkBadges(mergedPRs, user.points);
        await user.save();

        results.push({
          username: user.username,
          status: "success",
          mergedCount: mergedPRs.length,
          points: user.points,
        });
      } catch (userError) {
        console.error(`Error processing user ${user.username}:`, userError);
        results.push({
          username: user.username,
          status: "error",
          error: userError.message,
        });
        continue;
      }
    }

    res.json({
      message: "PR status update completed",
      results,
    });
  } catch (error) {
    console.error("Error in PR status update:", error);
    res.status(500).json({
      error: "Failed to update PR status",
      details: error.message,
    });
  }
});

// Add automatic PR status and leaderboard update
setInterval(async () => {
  try {
    const response = await fetch(
      `http://localhost:${process.env.PORT}/api/github/prs/update`
    );

    if (!response.ok) {
      throw new Error(`Update failed with status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Scheduled update completed:", result);
  } catch (error) {
    console.error("Scheduled update failed:", error);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Enhanced GitHub API routes with Octokit
app.get("/api/github/user/:username", async (req, res) => {
  try {
    // Get basic user data
    const { data: userData } = await octokit.users.getByUsername({
      username: req.params.username,
    });

    // Get contribution data using GraphQL
    const {
      data: { user },
    } = await octokit.graphql(
      `
            query($username: String!) {
                user(login: $username) {
                    contributionsCollection {
                        totalCommitContributions
                        contributionCalendar {
                            totalContributions
                            weeks {
                                contributionDays {
                                    contributionCount
                                    date
                                }
                            }
                        }
                    }
                }
            }
        `,
      {
        username: req.params.username,
      }
    );

    res.json({
      ...userData,
      contributions: user.contributionsCollection,
    });
  } catch (error) {
    console.error("Error fetching GitHub user data:", error);
    res.status(500).json({ error: "Failed to fetch GitHub data" });
  }
});

app.get("/api/github/events/:username/pushes", async (req, res) => {
  try {
    const { data } = await octokit.activity.listPublicEventsForUser({
      username: req.params.username,
      per_page: 10,
    });

    const pushEvents = data.filter((event) => event.type === "PushEvent");
    res.json(pushEvents);
  } catch (error) {
    console.error("Error fetching push events:", error);
    res.status(500).json({ error: "Failed to fetch push events" });
  }
});

app.get("/api/github/events/:username/prs", async (req, res) => {
  try {
    const { data } = await octokit.search.issuesAndPullRequests({
      q: `type:pr+author:${req.params.username}`,
      per_page: 10,
      sort: "updated",
      order: "desc",
    });
    res.json(data.items);
  } catch (error) {
    console.error("Error fetching PRs:", error);
    res.status(500).json({ error: "Failed to fetch pull requests" });
  }
});

app.get("/api/github/events/:username/merges", async (req, res) => {
  try {
    const { data } = await octokit.search.issuesAndPullRequests({
      q: `type:pr+author:${req.params.username}+is:merged`,
      per_page: 10,
      sort: "updated",
      order: "desc",
    });
    res.json(data.items);
  } catch (error) {
    console.error("Error fetching merges:", error);
    res.status(500).json({ error: "Failed to fetch merged PRs" });
  }
});

// Add new comprehensive user profile endpoint
app.get("/api/user/profile/:username", async (req, res) => {
  try {
    // Get GitHub user data and DevSync data
    const [userData, acceptedRepos, user] = await Promise.all([
      octokit.users.getByUsername({ username: req.params.username }),
      Repo.find({ reviewStatus: "accepted" }, "repoLink"),
      User.findOne({ username: req.params.username }, "mergedPRs"),
    ]);

    const { data } = await octokit.search.issuesAndPullRequests({
      q: `type:pr+author:${req.params.username}+created:>=${PROGRAM_START_DATE}`,
      per_page: 10,
      sort: "updated",
      order: "desc",
    });

    const pullRequests = await Promise.all(
      data.items.map(async (pr) => {
        const repoUrl = `https://github.com/${
          pr.repository_url.split("/repos/")[1]
        }`;
        const isDevSyncRepo = acceptedRepos.some(
          (repo) => repo.repoLink === repoUrl
        );

        // Get additional PR details
        const [owner, repo] = pr.repository_url.split("/repos/")[1].split("/");
        const { data: prDetails } = await octokit.pulls.get({
          owner,
          repo,
          pull_number: pr.number,
        });

        // Check if PR is detected by DevSync
        const isDevSyncDetected = user?.mergedPRs.some(
          (mergedPr) =>
            mergedPr.repoId === repoUrl && mergedPr.prNumber === pr.number
        );

        return {
          id: pr.id,
          title: pr.title,
          number: pr.number,
          state: pr.state,
          createdAt: pr.created_at,
          url: pr.html_url,
          repository: pr.repository_url.split("/repos/")[1],
          isDevSyncRepo,
          merged: prDetails.merged,
          closed: pr.state === "closed" && !prDetails.merged,
          isDevSyncDetected: isDevSyncRepo ? isDevSyncDetected : false,
        };
      })
    );

    const profileData = {
      ...userData.data,
      pullRequests,
      programStartDate: PROGRAM_START_DATE, // Add start date to response
    };

    res.json(profileData);
  } catch (error) {
    console.error("Error fetching profile data:", error);
    res.status(500).json({ error: "Failed to fetch profile data" });
  }
});

app.use(express.static(path.join(__dirname, "public")));

// Serve index.html for all routes to support client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Update static file serving
app.use(express.static(path.join(__dirname, "public")));

// Update cors configuration to handle frontend requests
app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);

// Initialize and start server
async function startServer() {
  try {
    const PORT = process.env.PORT || 3000;

    // Ensure all routes are registered before the catch-all

    // Catch-all route for SPA - must be after API routes
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    app
      .listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log("Serving frontend from", path.join(__dirname, "public"));
      })
      .on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.error(`Port ${PORT} is already in use`);
          process.exit(1);
        } else {
          throw err;
        }
      });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
