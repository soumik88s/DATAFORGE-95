# DATAFORGE 95

## Interactive Data Analytics & Intelligence Platform

DATAFORGE 95 is a full-stack data analytics platform designed to help users upload, explore, clean, analyze, visualize, and understand datasets through a Windows 95-inspired interface.

The project combines modern web technologies with a retro desktop-style user experience.

---

## Features

* User registration and login
* Role-based access control
* Admin, Analyst, and Viewer roles
* CSV and Excel file upload
* Dataset preview and management
* Data validation and cleaning
* Statistical analysis
* Correlation analysis
* Trend analysis
* Anomaly and outlier detection
* Interactive data visualizations
* Data filtering and sorting
* Analytical reports
* Dataset history and activity tracking
* Responsive interface
* Light and dark mode

---

## User Roles

### Admin

Administrators can:

* Manage users
* Manage datasets
* Manage platform settings
* Monitor activity
* Control user permissions

### Analyst

Analysts can:

* Upload datasets
* Inspect datasets
* Clean data
* Analyze data
* Detect anomalies
* Create visualizations
* Generate reports

### Viewer

Viewers can:

* View datasets
* Explore dashboards
* View analytical results
* Filter available data
* View reports

---

## Data Analysis Workflow

```text
Upload Dataset
      |
      v
Dataset Validation
      |
      v
Data Cleaning
      |
      v
Statistical Analysis
      |
      v
Correlation & Trend Analysis
      |
      v
Anomaly Detection
      |
      v
Data Visualization
      |
      v
Report Generation
```

---

## Technology Stack

### Frontend

* React
* TypeScript
* D3.js
* HTML
* CSS

### Backend

* Node.js
* TypeScript
* REST API

### Data Processing

* Dataset validation
* Statistical analysis
* Data cleaning
* Outlier detection
* Correlation analysis

### Database

* PostgreSQL

---

## Project Structure

```text
DATAFORGE-95/
|
├── src/
├── components/
├── pages/
├── services/
├── server/
├── public/
├── tests/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

The exact structure may vary depending on the current implementation.

---

## Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/dataforge-95.git
```

Navigate to the project:

```bash
cd dataforge-95
```

Install dependencies:

```bash
npm install
```

---

## Environment Configuration

Create a `.env` file based on `.env.example`.

Example:

```env
DATABASE_URL=your_database_url
PORT=3000
```

Do not upload `.env` files containing passwords, API keys, database credentials, or other sensitive information.

---

## Run the Project

Start the development server:

```bash
npm run dev
```

The application will run on the configured local development port.

---

## Testing

The application should be tested for:

### Authentication

* Registration
* Login
* Logout
* Invalid login credentials
* Role-based permissions

### File Upload

* CSV upload
* Excel upload
* Invalid file types
* Empty files
* Large files
* Missing values
* Duplicate records

### Analytics

* Statistical calculations
* Correlation analysis
* Trend analysis
* Anomaly detection
* Data filtering

### Security

* Protected routes
* API authorization
* Role permissions
* Input validation
* Environment variable protection

---

## Project Objective

The main objective of DATAFORGE 95 is to create a complete data analytics workflow in a single platform.

The project combines:

```text
Data Processing
      +
Data Analytics
      +
Data Visualization
      +
Authentication
      +
Role-Based Access
      +
Modern Web Development
```

---

## Future Improvements

* AI-assisted data analysis
* Automated insight generation
* Advanced anomaly detection
* PDF report generation
* Cloud deployment
* Docker support
* Real-time analytics
* Advanced dashboards
* Automated testing
* Data export functionality

---

## Screenshots

Screenshots of the following sections can be added here:

* Landing Page
* Login Page
* Dashboard
* Dataset Upload
* Dataset Preview
* Analytics
* Visualizations
* Reports
* Admin Panel

Example:

```markdown
![Dashboard](screenshots/dashboard.png)
```

---

## Author

**Soumik Chakraborty**

B.Tech — Computer Science and Business Systems

Interests:

* Full Stack Development
* Artificial Intelligence
* Data Analytics
* Software Development

---

## License

This project is developed for educational, portfolio, and experimental purposes.
