# HeartMap Frontend

React.js frontend application with animations, interactive maps, and real-time features.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Add your Google Maps API key (optional)
```

3. Start development server:
```bash
npm start
```

Opens at [http://localhost:3000](http://localhost:3000)

## Authentication backend

The authentication API lives in `../backend` and uses MongoDB, bcrypt, JWTs in
HTTP-only cookies, and the `user`, `ngo`, and `admin` roles.

```bash
cd ../backend
cp .env.example .env
# Set MONGODB_URI, JWT_SECRET, and CLIENT_ORIGIN in .env
npm install
npm start
```

Create an administrator from the backend directory with a strong password:

```bash
npm run create-admin -- "HeartMap Admin" admin@example.com "StrongPassword123"
```

Set `REACT_APP_API_URL=http://localhost:5000/api` in the frontend `.env` for
authentication and role-specific API requests. Secrets must remain in the
backend environment and must never be placed in `REACT_APP_*` variables.

### HeartMap AI Donation Assistant

The protected `/assistant` route sends natural-language donation questions to
`POST /api/ai/donation-assistant`. The backend AI provider extracts structured
intent only; MongoDB supplies the NGO names, locations, accepted donation types,
needs, verification status, contact details, and external donation links shown
in the response. The AI never creates NGO records or invents organizations.

Configure the provider only in `backend/.env`:

```bash
AI_API_KEY=your-server-side-provider-key
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4o-mini
```

The frontend never receives or stores `AI_API_KEY`. The endpoint requires an
authenticated user, validates message length, rate-limits requests, and times
out provider calls after 12 seconds.

## Components

### Pages
- **HomePage** - Main page with map and story grid
- **StoryPage** - Detailed story view with animations
- **DonatePage** - Donation form with progress tracking
- **AdminPage** - Story submission form

### Components
- **Navigation** - App navigation bar
- **MapComponent** - Interactive story map
- **ChatBox** - Real-time community chat

## Features

- ✨ Framer Motion animations
- 🎭 Lottie story animations
- 🗺️ Interactive map visualization
- 💬 Real-time chat
- 📱 Fully responsive design
- 🎨 Beautiful gradient themes

## Technologies

- React Router - Navigation
- Framer Motion - Animations
- Lottie - Story animations
- Axios - API calls
- CSS3 - Styling

## Available Scripts

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
