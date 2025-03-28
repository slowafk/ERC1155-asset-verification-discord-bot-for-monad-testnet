## PREREQUISITES
- AWS Account
- MongoDB Account
- Discord Developer Account (to create the bot and get tokens)
- Domain name for the verification website (if using a custom domain)

### CREATE A DISCORD BOT
- Go to https://discord.com/developers/applications
- Click "New Application" and give it a name
- Go to the "Bot" tab and click "Add Bot"
- Enable "MESSAGE CONTENT INTENT" and "SERVER MEMBERS INTENT"
- Copy the bot token (for DISCORD_TOKEN in .env)
- Go to OAuth2 > URL Generator
- Select scopes: bot, applications.commands
- Select permissions: Manage Roles, Send Messages, Read Messages
- Use the generated URL to invite the bot to your server

### CREATE AN EC2 INSTANCE

#### LOG INTO AWS CONSOLE
- Go to https://aws.amazon.com/console/
- Sign in to your account

#### LAUNCH EC2 INSTACE
- Go to EC2 dashboard
- Click "Launch Instance"
- Choose Amazon Linux 2023
- Select t2.micro (free tier eligible)
- Create or select a key pair (download the .pem file)
- Configure security groups:
  - Allow SSH (port 22) from your IP
  - Allow HTTP (port 80) and HTTPS (port 443) from anywhere
  - Allow custom TCP on port 3000 from your load balancer security group
- Click "Launch Instance"

### SET UP APPLICATION LOAD BALANCER
- Create a Target Group (port 3000, pointing to your EC2 instance)
- Create an Application Load Balancer
- Configure listeners for HTTP (80) and HTTPS (443)
- Request SSL certificate through AWS Certificate Manager
- Set up HTTP to HTTPS redirect

### CONFIGURE DNS
- In your domain registrar, create a CNAME record
- Point your verification subdomain to your load balancer DNS

### CONVERT .PEM TO .PPK FOR PUTTY
- Download PuTTYgen from the PuTTY website if you don't have it
- Open PuTTYgen
- Click "Load" and select your .pem file
- Click "Save Private Key" to create a .ppk file

### CONNECT TO THE INSTANCE WITH PUTTY

#### OPEN PUTTY
- Enter your EC2 public DNS or IP in the "Host Name" field
- Default port: 22

#### CONFIGURE SSH AUTH
- In the left panel, go to Connection > SSH > Auth > Credentials
- Browse and select your .ppk file
- In Connection > Data, set "Auto-login username" to "ec2-user"
- Click "Open" to start the SSH session

### CREATE DATABASE ON MONGO DB CLOUD ATLAS
- Go to https://www.mongodb.com/
- Sign in to your account

### CREATE MONGODB DATABASE
- Go to MongoDB Atlas and create a new cluster (or use existing)
- Create a database user with password
- Set up Network Access to allow your EC2 IP
- Get your connection string from "Connect" > "Connect your application"
- Add this connection string to your .env file

### SET UP ENVIRONMENT ON EC2
``` # Update system packages
sudo yum update -y

# Install PM2 globally
sudo npm install -g pm2

# Create project directory
mkdir -p ~/discord-nft-bot/public
```

### CREATE DIRECTORY STRUCTURE IN PUTTY
``` # Create project directory and subdirectories
mkdir -p ~/discord-nft-bot/public
cd ~/discord-nft-bot
```
### CREATE AND EDIT FILES WITH NANO

#### CREATE INDEX.JS
```nano index.js```
- Paste the complete index.js code
- To paste in PuTTY: Right-click in the terminal window (or press Shift+Insert)
- Update <YOUR_CONTRACT_HERE> on lines 293 and 371 with your contract address
- Save and exit with: Ctrl+X, then Y, then Enter

#### CREATE PACKAGE.JSON FILE
```nano package.json```
- Paste the complete package.json code
- Save and exit: Ctrl+X, Y, Enter

#### CREATE PACKAGE-LOCK.JSON FILE
```nano package-lock.json```
- Paste the complete package-lock.json code
- Save and exit: Ctrl+X, Y, Enter

#### CREATE .ENV FILE
```nano .env```
- Paste .env contents with tokens, logins, etc. added
- Save and exit: Ctrl+X, Y, Enter

#### CREATE INDEX.HTML FILE
```nano public/index.html```
- Paste the complete index.html code
- Save and exit: Ctrl+X, Y, Enter

#### CREATE WALLET.HTML FILE
```nano public/wallet.html```
- Paste the complete wallet.html code
- Save and exit: Ctrl+X, Y, Enter

#### CREATE STYLES.CSS FILE
```nano public/styles.css```
- Paste the complete styles.cs code
- Save and exit: Ctrl+X, Y, Enter

### INSTALL DEPENDENCIES
```# Update system packages
sudo yum update -y

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -
sudo yum install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install project dependencies
npm init -y
npm install discord.js ethers express cors node-cron mongoose dotenv
```

### START THE BOT
```# Start with PM2
pm2 start index.js --name "nft-vrf-bot"

# Configure PM2 to start on reboot
pm2 startup
# Run the command it outputs
pm2 save

# View logs
pm2 logs nft-vrf-bot
```

### VERIFY BOT IS WORKING
- Check bot is online in your Discord server
- Test /verify command
- Monitor logs: `pm2 logs nft-vrf-bot`
- Check MongoDB connection
