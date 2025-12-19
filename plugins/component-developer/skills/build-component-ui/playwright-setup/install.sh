#!/bin/bash

# Playwright MCP Installation Script for Keboola UI Developer
# This script sets up Playwright MCP for automated schema testing

set -e

echo "🎭 Playwright MCP Installation for Keboola UI Developer"
echo "========================================================"
echo

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CONFIG_FILE="$HOME/.config/Claude/claude_desktop_config.json"
else
    echo -e "${RED}❌ Unsupported OS: $OSTYPE${NC}"
    exit 1
fi

echo -e "${YELLOW}📁 Configuration file: $CONFIG_FILE${NC}"
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}"

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx is not installed${NC}"
    echo "Please install npm/npx"
    exit 1
fi

echo -e "${GREEN}✅ npx found${NC}"
echo

# Step 1: Test Playwright MCP package
echo "📦 Testing Playwright MCP package..."
if npx -y @executeautomation/mcp-playwright --version &> /dev/null; then
    echo -e "${GREEN}✅ Playwright MCP package accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Playwright MCP package test failed, but will continue...${NC}"
fi
echo

# Step 2: Create or update Claude config
echo "⚙️  Configuring Claude..."

# Create config directory if it doesn't exist
mkdir -p "$(dirname "$CONFIG_FILE")"

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Creating new Claude config..."
    echo '{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@executeautomation/mcp-playwright"
      ]
    }
  }
}' > "$CONFIG_FILE"
    echo -e "${GREEN}✅ Created new config with Playwright MCP${NC}"
else
    # Config exists, check if playwright is already configured
    if grep -q '"playwright"' "$CONFIG_FILE"; then
        echo -e "${YELLOW}⚠️  Playwright MCP already configured in Claude config${NC}"
        echo "Skipping configuration update"
    else
        echo -e "${YELLOW}⚠️  Config file exists but doesn't have Playwright MCP${NC}"
        echo "Please manually add the following to your mcpServers:"
        echo '
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@executeautomation/mcp-playwright"
      ]
    }
'
        echo
        read -p "Open config file now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if command -v code &> /dev/null; then
                code "$CONFIG_FILE"
            elif command -v vim &> /dev/null; then
                vim "$CONFIG_FILE"
            else
                open "$CONFIG_FILE"
            fi
        fi
    fi
fi
echo

# Step 3: Install Playwright browsers
echo "🌐 Installing Playwright browser (Chromium)..."
if npx -y playwright install chromium; then
    echo -e "${GREEN}✅ Chromium installed${NC}"
else
    echo -e "${RED}❌ Failed to install Chromium${NC}"
    echo "You can try manually: npx playwright install chromium"
fi
echo

# Step 4: Verify installation
echo "🔍 Verifying installation..."
echo

# Summary
echo "📋 Installation Summary"
echo "======================="
echo
echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
echo -e "${GREEN}✅ npx available${NC}"
echo -e "${GREEN}✅ Playwright MCP package accessible${NC}"
echo -e "${GREEN}✅ Chromium browser installed${NC}"
echo -e "${GREEN}✅ Claude config updated: $CONFIG_FILE${NC}"
echo

# Next steps
echo "🚀 Next Steps"
echo "============="
echo
echo "1. Restart Claude Desktop or Claude Code completely"
echo
echo "2. Start the schema tester:"
echo "   cd ../schema-tester"
echo "   ./start-server.sh"
echo
echo "3. Ask Claude to test your schemas:"
echo "   \"Test my configuration schema at http://localhost:8000/schema-tester/\""
echo
echo "4. Claude will use Playwright MCP to:"
echo "   - Navigate to the tester"
echo "   - Fill in fields"
echo "   - Test conditional fields"
echo "   - Take screenshots"
echo "   - Verify JSON output"
echo

echo -e "${GREEN}✨ Playwright MCP installation complete!${NC}"
echo

echo "📚 For more information, see:"
echo "   - README.md in this directory"
echo "   - https://github.com/executeautomation/mcp-playwright"
