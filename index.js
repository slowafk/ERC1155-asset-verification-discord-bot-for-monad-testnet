// Discord ERC-1155 Token Verification Bot
// This bot checks if users own specific ERC-1155 tokens and assigns Discord roles accordingly
// Includes periodic verification to ensure continued token ownership
// Configured for Monad Testnet (Chain ID: 10143)

/*
 * Monad Testnet Troubleshooting:
 * 
 * 1. Make sure you're using the correct RPC URL: https://testnet-rpc.monad.xyz/
 * 2. Ensure your ERC-1155 contract is deployed on Monad Testnet (Chain ID: 10143)
 * 3. For contract interactions, the Monad Testnet may have specific gas requirements
 * 4. The block explorer URL for checking transactions: https://testnet.monadexplorer.com/
 * 5. Currency symbol: MON
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, 
       PermissionsBitField, ApplicationCommandOptionType } = require('discord.js');
const mongoose = require('mongoose');
const { ethers } = require('ethers');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const fs = require('fs');
const path = require('path');
const { Web3 } = require('web3');

// Load environment variables
const {
  DISCORD_BOT_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  ETHEREUM_RPC_URL = "https://testnet-rpc.monad.xyz/",
  ERC1155_CONTRACTS,
  DISCORD_GUILD_ID,
  DISCORD_ROLE_ID,
  SESSION_SECRET,
  MONGODB_URI,
  CHAIN_ID = 10143,
  BLOCK_EXPLORER_URL = "https://testnet.monadexplorer.com/",
  VERIFICATION_INTERVAL_HOURS = 24,
  PORT = 3000
} = process.env;

// Initialize Express app
const app = express();

// Initialize Discord bot client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel]
});

// Initialize Web3 and Ethereum providers
const web3Instance = new Web3(new Web3.providers.HttpProvider(ETHEREUM_RPC_URL));

// Configure provider with proper network settings
const provider = new ethers.JsonRpcProvider(ETHEREUM_RPC_URL, {
  chainId: parseInt(CHAIN_ID),
  name: 'Monad Testnet',
  ensAddress: null,
  skipFetchSetup: true
});

// Configure Web3 for Monad Testnet
const monadTestnet = {
  id: parseInt(CHAIN_ID),
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: { http: [ETHEREUM_RPC_URL] },
    public: { http: [ETHEREUM_RPC_URL] },
  },
  blockExplorers: {
    default: { name: 'MonadExplorer', url: BLOCK_EXPLORER_URL },
  },
  testnet: true
};

// Test provider connection
provider.getNetwork().then(network => {
  console.log('Connected to network:', network.name, 'Chain ID:', network.chainId);
}).catch(error => {
  console.error('Error connecting to network:', error);
});

// Parse contracts and token IDs from env variable
const contracts = [];
try {
  const contractsConfig = JSON.parse(ERC1155_CONTRACTS);
  contractsConfig.forEach(config => {
    contracts.push({
      address: config.address,
      tokenIds: config.tokenIds.split(',').map(id => id.trim())
    });
  });
} catch (error) {
  console.error('Error parsing ERC1155_CONTRACTS:', error);
  console.error('Using default empty contract list. Please check your .env file.');
}

// ERC-1155 ABI
const erc1155Abi = [
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])",
  "function isApprovedForAll(address account, address operator) view returns (bool)"
];

// MongoDB Schema
const VerifiedUserSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  walletAddress: { type: String, required: true },
  verifiedTokens: [{
    contractAddress: { type: String, required: true },
    tokenIds: [{ type: String, required: true }]
  }],
  lastVerified: { type: Date, default: Date.now },
  isCurrentlyVerified: { type: Boolean, default: true }
});

const VerifiedUser = mongoose.model('VerifiedUser', VerifiedUserSchema);

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public'), {
  index: false, // Disable automatic serving of index.html
  dotfiles: 'deny' // Deny access to dotfiles
}));

// Session middleware
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(new DiscordStrategy({
  clientID: DISCORD_CLIENT_ID,
  clientSecret: DISCORD_CLIENT_SECRET,
  callbackURL: DISCORD_REDIRECT_URI,
  scope: ['identify', 'guilds.join']
}, (accessToken, refreshToken, profile, done) => {
  return done(null, {
    id: profile.id,
    username: profile.username,
    accessToken
  });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Create public directory and ensure required files exist
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
  console.log('Created public directory');
}

// Create index.html if it doesn't exist
const indexPath = path.join(publicDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  const indexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MONAD TEST NET ASSET VERIFICATION</title>
    <link href="/styles.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="card-header text-center py-4">
                <h1>Discord Token Verification</h1>
            </div>
            <div class="card-body text-center py-5">
                <p class="lead mb-4">connect your wallet to verify your token ownership and get access to exclusive Discord channels.</p>
                <a href="/auth/discord" class="btn btn-discord btn-lg text-white">
                    Login with Discord
                </a>
            </div>
        </div>
    </div>
</body>
</html>`;
  fs.writeFileSync(indexPath, indexContent);
  console.log('Created index.html');
}

// Ensure styles.css exists
const stylesPath = path.join(publicDir, 'styles.css');
if (!fs.existsSync(stylesPath)) {
  const cssContent = `
body {
    background-color: #36393f;
    color: #ffffff;
    font-family: 'Helvetica Neue', Arial, sans-serif;
}

.container {
    max-width: 800px;
    margin-top: 50px;
}

.card {
    background-color: #2f3136;
    border: none;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.card-header {
    background-color: #202225;
    border-bottom: none;
    border-radius: 8px 8px 0 0;
}

.btn-discord {
    background-color: #5865F2;
    border: none;
    padding: 12px 24px;
    font-size: 1.1em;
}

.btn-discord:hover {
    background-color: #4752c4;
}`;
  fs.writeFileSync(stylesPath, cssContent);
  console.log('Created styles.css');
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback', 
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => res.redirect('/connect-wallet')
);

app.get('/connect-wallet', (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.redirect('/');
    }
    
    const walletHtmlPath = path.join(__dirname, 'public', 'wallet.html');
    if (!fs.existsSync(walletHtmlPath)) {
      console.error('wallet.html not found');
      return res.status(500).send('Error: Wallet page not found');
    }

    let walletHtml = fs.readFileSync(walletHtmlPath, 'utf8');
    
    // Only process the file if it starts with <!DOCTYPE html>
    if (!walletHtml.trim().startsWith('<!DOCTYPE html>')) {
      console.error('Invalid wallet.html content');
      return res.status(500).send('Error: Invalid wallet page content');
    }
    
    // Create the configuration object with the required contract addresses
    const config = {
      contracts: [
        {
          address: '<YOUR_CONTRACT_ADDRESS>',
          tokenIds: ['0']
        },
      ],
      chainId: parseInt(CHAIN_ID),
      rpcUrl: ETHEREUM_RPC_URL,
      discordId: req.user.id,
      explorerUrl: BLOCK_EXPLORER_URL
    };
    
    // Replace the configuration placeholder with actual values
    const configScript = `<script>window.APP_CONFIG = ${JSON.stringify(config, null, 2)};</script>`;
    walletHtml = walletHtml.replace(
      /<script>\s*window\.APP_CONFIG\s*=\s*{[^}]*};?\s*<\/script>/,
      configScript
    );
    
    // Set proper content type and send the response
    res.setHeader('Content-Type', 'text/html');
    res.send(walletHtml);
  } catch (error) {
    console.error('Error in connect-wallet route:', error);
    res.status(500).send('Error loading wallet page');
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

// Add the verify-wallet endpoint
app.post('/verify-wallet', async (req, res) => {
  console.log('Received verification request');
  
  try {
    const { walletAddress, signature, message, ownedTokensByContract } = req.body;
    
    if (!walletAddress || !signature || !message || !ownedTokensByContract) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    console.log('Recovered address:', recoveredAddress);
    console.log('Wallet address:', walletAddress);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid signature' 
      });
    }

    // Check if user exists in session
    if (!req.session || !req.session.passport || !req.session.passport.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'No Discord session found' 
      });
    }

    const discordId = req.session.passport.user.id;

    // Verify token ownership
    let isVerified = false;
    for (const contractData of ownedTokensByContract) {
      const contractAddress = contractData.contractAddress.toLowerCase();
      console.log(`Checking contract ${contractAddress} for tokens...`);
      
      // Check if this is one of our target contracts
      if (contractAddress === '<YOUR_CONTRACT_ADDRESS>'.toLowerCase()) {
        try {
          // Create contract instance with minimal ABI
          const contract = new ethers.Contract(
            contractAddress,
            ["function balanceOf(address,uint256) view returns (uint256)"],
            provider
          );

          // Check token ID 0 with retry logic
          console.log(`Checking token ID 0 for address ${walletAddress}...`);
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount < maxRetries) {
            try {
              const balance = await contract.balanceOf(walletAddress, 0);
              console.log(`Balance for token 0: ${balance.toString()}`);
              
              // Convert balance to number for comparison
              const balanceNum = Number(balance.toString());
              if (balanceNum > 0) {
                isVerified = true;
                console.log('Token ownership verified successfully');
                break;
              }
              break; // If we get here, balance check succeeded but was 0
            } catch (balanceError) {
              retryCount++;
              console.error(`Error checking balance (attempt ${retryCount}):`, balanceError);
              if (retryCount < maxRetries) {
                console.log(`Retrying in 2 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          }
          
          if (isVerified) break; // Exit the contract loop if verified
        } catch (error) {
          console.error(`Error checking token balance for contract ${contractAddress}:`, error);
          continue;
        }
      }
    }

    if (!isVerified) {
      return res.status(400).json({
        success: false,
        message: "You don't own any tokens from the required contracts. Please mint or acquire a token to verify."
      });
    }

    // Update or create user in database
    try {
      let user = await VerifiedUser.findOne({ discordId });
      
      if (user) {
        user.walletAddress = walletAddress;
        user.isCurrentlyVerified = true;
        user.lastVerifiedAt = new Date();
        await user.save();
      } else {
        user = new VerifiedUser({
          discordId,
          walletAddress,
          isCurrentlyVerified: true,
          lastVerifiedAt: new Date()
        });
        await user.save();
      }

      // Add role in Discord
      try {
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
        const member = await guild.members.fetch(discordId);
        await member.roles.add(DISCORD_ROLE_ID);
        
        return res.json({
          success: true,
          message: 'verification successful! role has been added.',
          guildId: DISCORD_GUILD_ID
        });
      } catch (discordError) {
        console.error('Discord role assignment error:', discordError);
        return res.status(500).json({
          success: false,
          message: 'Verified, but failed to assign Discord role. Please contact an admin.'
        });
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database error during verification. Please try again.'
      });
    }
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error during verification process'
    });
  }
});

// Register slash command when bot is ready
client.once('ready', async () => {
  try {
    const command = {
      name: 'verify',
      description: 'Start the wallet verification process'
    };

    await client.application.commands.create(command);
    console.log('Slash command registered successfully');
  } catch (error) {
    console.error('Error registering slash command:', error);
  }
});

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'verify') {
    try {
      // Generate verification URL with user's Discord ID
      const verificationUrl = `${process.env.BASE_URL || `http://localhost:${PORT}`}`;
      
      await interaction.reply({
        content: 'Click the link below to start the verification process:',
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: 'Verify Wallet',
                url: verificationUrl
              }
            ]
          }
        ],
        ephemeral: true
      });
    } catch (error) {
      console.error('Error handling verify command:', error);
      await interaction.reply({
        content: 'An error occurred while processing your request. Please try again later.',
        ephemeral: true
      });
    }
  }
});

// Test route for session
app.get('/test-session', (req, res) => {
  if (!req.session.views) {
    req.session.views = 1;
    res.send('Welcome! This is your first visit. Refresh to test session.');
  } else {
    req.session.views++;
    res.send(`You have visited this page ${req.session.views} times. Session is working!`);
  }
});

// MongoDB connection with proper options
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 15000, // Timeout after 15 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4, // Use IPv4, skip trying IPv6
  maxPoolSize: 10, // Maximum number of connections in the pool
  minPoolSize: 1, // Minimum number of connections in the pool
  connectTimeoutMS: 10000 // Give up initial connection after 10 seconds
}).then(() => {
  console.log('Connected to MongoDB successfully');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Add connection error handler
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

// Add connection success handler
mongoose.connection.once('open', () => {
  console.log('MongoDB connection opened successfully');
});

// Update the periodic verification function with error handling
async function runPeriodicVerification() {
  console.log('Starting periodic verification check...');
  
  try {
    if (!mongoose.connection.readyState) {
      console.warn('MongoDB not connected. Skipping periodic verification.');
      return;
    }

    // Find all verified users
    const verifiedUsers = await VerifiedUser.find({ isCurrentlyVerified: true });
    console.log(`Checking ${verifiedUsers.length} verified users`);
    
    let removedCount = 0;
    
    // Check each user's token ownership
    for (const user of verifiedUsers) {
      try {
        // Verify token ownership for each contract
        let foundTokens = false;
        for (const contractInfo of contracts) {
          const contract = new ethers.Contract(contractInfo.address, erc1155Abi, provider);
          
          // Check token IDs 0-100
          for (let tokenId = 0; tokenId <= 100; tokenId++) {
            try {
              const balance = await contract.balanceOf(user.walletAddress, tokenId);
              if (balance.gt(0)) {
                foundTokens = true;
                break;
              }
            } catch (tokenError) {
              console.error(`Error checking token ${tokenId} for user ${user.discordId}:`, tokenError);
              continue; // Skip to next token ID
            }
          }
          
          if (foundTokens) break; // Exit contract loop if tokens found
        }

        if (!foundTokens) {
          // User no longer owns any required token, remove role
          console.log(`User ${user.discordId} no longer owns any required tokens. Removing role.`);
          const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
          const member = await guild.members.fetch(user.discordId);
          await member.roles.remove(DISCORD_ROLE_ID);
          await updateUserVerification(user, false);
          removedCount++;
        } else {
          // Update verification timestamp
          await updateUserVerification(user, true);
        }
      } catch (userError) {
        console.error(`Error processing user ${user.discordId}:`, userError);
        continue; // Skip to next user
      }
    }
    
    console.log(`Verification complete. Removed roles from ${removedCount} users.`);
  } catch (error) {
    console.error('Error during periodic verification:', error);
  } finally {
    // Schedule next verification
    setTimeout(runPeriodicVerification, VERIFICATION_INTERVAL_HOURS * 60 * 60 * 1000);
  }
}

// Update server startup to use the new MongoDB connection
async function startServer() {
  try {
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
    
    // Start the Discord bot
    await client.login(DISCORD_BOT_TOKEN);
    console.log(`Discord bot logged in successfully!
Server and bot are ready to handle verification requests.`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Call the startServer function
startServer();