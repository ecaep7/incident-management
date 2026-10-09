AI-assisted triage for Incident Management System.

A web app that digitises the entire incident lifecycle of a network ops unit, from when an alert is received, through to it being resolved and verified, and provides an LLM suggestion for how to deal with each incident.

Construction of the graduation thesis of the National Economics University (Management Information Systems).

## Problem

As a VNPT-Net intern in Digital Transformation Center, I noticed that incident handling was performed using many scattered tickets and manual coordination. There was a lack of good flow of information between steps, between teams, and no one place to see an incident from start to finish.

This project simplifies that workflow in one system, defines roles, keeps a history of every incident and keeps track of SLA automatically.

## Screenshots

**Admin dashboard**
<img width="1920" height="877" alt="image" src="https://github.com/user-attachments/assets/06b8aa1b-b83a-42e3-94f2-eec4ca542e17" />


On an incoming alert, AI provides suggestions.
<img width="1920" height="877" alt="image" src="https://github.com/user-attachments/assets/6b187332-b0df-4ffd-ad3b-2af0fa4b70b1" />


**Ticket detail**
<img width="1920" height="873" alt="image" src="https://github.com/user-attachments/assets/8b849b1c-1849-4758-82f7-1f591e0c518e" />


**Handler view**
<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/69ecf8d2-efde-437b-9219-cee52c65276d" />
<img width="1919" height="915" alt="image" src="https://github.com/user-attachments/assets/11beef69-5f68-430a-9ed4-bb9e092cc31e" />


## Key Features

Registered network devices send alerts to a queue which are verified by the Admin as real alerts or closed as false alarms with a reason.
- AI assisted triage: An LLM suggests which incident type and handling direction to take with each alert and the Admin decides.
Confirmed incidents are converted to tickets and divided into tasks directly to individual handlers.
Review loop: Handlers submit results containing attachments and the Admin completes each task as passed or failed before the ticket can be closed.
The scheduled workflow will flag tickets if they go beyond their time limits, this is called SLA monitoring.
DASHBOARDS will be company-wide view for managers and a personal performance view for each handler.
- Audit trail: who did what and when.

## AI-Assisted Triage

If a new alert comes up, the system will forward the information to Gemini and receive back:

A recommended goal for the kind of incident.A proposed goal of the type of incident.
- a proposed handling direction: either ONSITE (must visit the site) or SYSTEM (will be fixed from the office).

The suggestion is displayed as a suggestion and the Admin can accept or reject it. Assigning departments and handlers always stays with the Admin.

The AI is not meant to make decisions, it is meant to aid in decision making. Network incidents do, indeed, pose risks to operations; a human remains responsible for all classifications. It's a human-in-the-loop design.

Put the evaluation result here after measurement, such as: "On a labeled test set of N alerts, the model's category suggestion aligned with the labeled on X% of cases.

## Workflow

<img width="1488" height="572" alt="image" src="https://github.com/user-attachments/assets/71fd9bd6-2bb5-4a5b-93bc-94646074443f" />

The flow of alert received to AI suggestion, admin verification, ticket created, tasks assigned to the handlers, handlers provide results, admin review, and finally ticket closed.

Assigned → Pending Review (rejected) → Closed

## Roles & Permissions

Trainer | Coaches the team |
|------|------------------|
Allows the Admin to review alerts and AI suggestions, create tickets, assign and review tasks, manage devices and user accounts, and view all dashboards |
Individual responsibilities for the handler: View and work on their own assigned tasks, submit results with attachments, monitor their own performance |
Read-only access to all tickets and the company-wide dashboard, cannot view raw unverified alerts or make any changes |

PostgreSQL RLS doesn't apply permissions in the UI alone, but in the database as well.

## Tech Stack

Layer 1 | Technology | Used for |
|-------|------------|----------|
Data storage, Row-Level Security, 6 Edge Functions for the core business logic | Database & backend | Supabase (PostgreSQL) |
Authentication | Supabase Auth | Log in via email and invite, create accounts |
SLA monitoring | scheduled | Automation | n8n |
Suggests Alert Category and direction for Handling |
Frontend | Next.js | Web user interface & dashboards for roles |

## Scope & Limitations

Created specifically for academic work as a graduation thesis and not put to use in production.
All alerts generated in the system are simulated based on true process documentation.
Alerts will not be accepted until the devices are registered.
- The alert queue is NOT updated in real time, it is updated periodically by polling.
- The n8n workflow is self-hosted, meaning that the SLA checks will only execute when the workflow is running.

## Author

Do Thi Thanh Binh
Program: Management Information Systems, National Economics University, Belarus.Program: Management Information Systems, National Economics University, Belarus.
[LinkedIn](https://www.linkedin.com/in/binh-do-thi-thanh-b171aa328/) · dothithanhbinh.work@gmail.com
