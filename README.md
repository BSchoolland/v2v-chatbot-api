# Visions to Visuals Chatbot API

A powerful, AI-powered chatbot service that seamlessly integrates with client websites to provide intelligent customer support by leveraging site content. This solution enables businesses to deploy a natural, context-aware chatbot in under 15 minutes.

## 🌟 Features

- **Quick Integration**: Deploy to any website in under 15 minutes
- **Content-Aware**: Automatically learns from your website content
- **Natural Interactions**: Powered by GPT-4 for human-like conversations
- **Customizable**: Adapt the chatbot's appearance and behavior to match your brand
- **Secure**: Built with industry-standard security practices
- **Analytics**: Track user interactions and chatbot performance

## 📋 Project Documentation

- [MVP Timeline](https://docs.google.com/document/d/1Qz8tVQ3WSa1k4AHqGyFnYlJ2nyxTQLzgzQcGsNlcgsY/edit?tab=t.0)
- [Project Requirements](https://docs.google.com/document/d/1ktSizXRecSuGVjeFcu6XElnkO5mh5ek4Nm6E1iimBlY/edit?tab=t.0#heading=h.gjdgxs)
- [Database Schema](https://lucid.app/lucidchart/c15da861-ecc7-4e22-8b6e-408c1dbd6849/edit?invitationId=inv_7e9d5164-4fa2-4f40-b466-8b5405b0bd8c&page=0_0#)

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd SolveCC-Chatbot
   ```

2. Create a `.env` file in the root directory with required environment variables:
   ```
   OPENAI_API_KEY=your_api_key
   DATABASE_URL=your_database_url
   JWT_SECRET=your_jwt_secret
   ```

3. Start the application:
   ```bash
   docker-compose up
   ```

The application will be available at:
- Development UI: http://localhost:3000
- API: http://localhost:3001
- Chatbot Frontend: http://localhost:3002

## 🏗️ Project Structure

- `/chatbot-api` - Core chatbot logic and AI integration
- `/chatbot-frontend` - Client-side chatbot widget
- `/development-ui` - Development interface for configuration
- `/website-api` - Backend API for the management dashboard
- `/webscraping` - Content extraction and processing
- `/database` - Database schemas and migrations
- `/tests` - Test suites
- `/api` - Public API endpoints

## 💻 Technology Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **AI Model**: OpenAI GPT-4
- **Containerization**: Docker
- **CI/CD**: GitHub Actions

## 🔧 Configuration

The chatbot can be configured through the development UI:
1. Navigate to `/development-ui/chatbot-setup.html`
2. Configure behavior, and content sources
3. Generate and copy the integration code
4. Add the code to your website

## 📦 Deployment

The project uses GitHub Actions for automated deployment. The workflow is defined in `.github/workflows/deploy.yml`.

To deploy manually:
1. Build the Docker images:
   ```bash
   docker-compose build
   ```
2. Push to your container registry:
   ```bash
   docker-compose push
   ```

## 🤖 AI Models

Currently using:
- OpenAI's GPT-4o-mini for natural language processing
- OpenAI's GPT-4o model for automated initial configuration of chatbots
- Additional models and capabilities coming soon!

## 🔒 Security

- JWT-based authentication
- HTTPS encryption
- Rate limiting
- Input sanitization


## 📄 License

This project is proprietary software owned by Visions to Visuals.
