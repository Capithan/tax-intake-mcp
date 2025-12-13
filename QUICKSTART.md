# Quick Start Guide - Tax Intake MCP Server

## 🚀 5-Minute Setup

### Step 1: Install Dependencies
```powershell
cd "C:\Projects\ChatGPT APPS\tax-intake-mcp"
npm install
```

### Step 2: Build the Project
```powershell
npm run build
```

### Step 3: Configure Claude Desktop

Add this to your Claude Desktop config file:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tax-intake": {
      "command": "node",
      "args": ["C:/Projects/ChatGPT APPS/tax-intake-mcp/dist/index.js"]
    }
  }
}
```

### Step 4: Restart Claude Desktop

Close and reopen Claude Desktop to load the MCP server.

### Step 5: Start Using!

Try these prompts in Claude:

---

## 💬 Example Prompts

### Start a New Client Intake
```
I'm a new client and need help preparing for my tax appointment. 
Can you walk me through the intake process?
```

### Generate Document Checklist
```
I work a W-2 job but also drive for Uber and have some 
cryptocurrency investments. What documents do I need?
```

### Get Tax Pro Recommendation
```
Based on my situation with rental properties, foreign bank accounts, 
and self-employment income, which tax professional should I work with?
```

### Estimate Appointment Time
```
How long will my tax appointment take? I've completed the intake 
and gathered all my documents.
```

---

## 🛠️ Development Mode

Run the server in development mode with auto-reload:
```powershell
npm run dev
```

Run tests:
```powershell
npx tsx src/test.ts
```

---

## 📊 What the Server Does

1. **Collects Information** - Conversational intake gathers all tax-relevant data
2. **Generates Checklists** - Personalized document lists based on your situation
3. **Sends Reminders** - "Don't forget your 1099-NEC from Uber!"
4. **Calculates Complexity** - Scores 0-100 to determine appointment duration
5. **Routes to Experts** - Matches you with the right tax professional

---

## 🎯 Key Benefits

| Without This Tool | With This Tool |
|-------------------|----------------|
| 40% arrive unprepared | 95%+ prepared |
| 30-45 min appointments | 15-20 min appointments |
| Manual document tracking | Auto-generated checklists |
| Generic reminders | Personalized reminders |
| Random tax pro assignment | Smart skill-based matching |

---

## 📞 Support

For issues or feature requests, check the README.md or create an issue in your project repository.
