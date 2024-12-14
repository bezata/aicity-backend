### Project Roadmap

#### 1. **Project Setup** _(2 days, completed in 8 hours 😎)_

- Set up API interactions for AI usage.
- Initialize vector databases for Retrieval-Augmented Generation (RAG) using tools like Pinecone.
- Initialize TogetherAI service.
- Set up services and basic routes.
- Initialize frontend structure.
- Set up AI agent functionality.

---

#### 2. **Phase: Make It Advanced** _(4 days)_

- Implement advanced AI agents with more complex personalities.
- Begin creating events to track and utilize key sustainability, economic, social, and infrastructure metrics.
- Enhance randomness framework to create a dynamic, realistic, and fully "alive" city environment.

##### **Sustainability Metrics:**

- Carbon emissions per capita.
- Ratio of renewable energy to fossil fuel usage.
- Green space and biodiversity indices.
- Air and water quality scores.

##### **Economic Health:**

- Employment rates, job growth, and industry diversification.
- Income distribution and Gini coefficient for equity.
- Business formation rates and innovation indices.
- Affordability metrics (e.g., housing costs vs. median income).

##### **Public Safety and Trust:**

- Crime rates (categorized by type and severity).
- Police response times and case resolution rates.
- Use-of-force incidents and community satisfaction with law enforcement.
- Public perception surveys on safety and justice.

##### **Social Well-Being:**

- Healthcare access (wait times, coverage, outcomes).
- Education quality (literacy rates, graduation rates, skill competencies).
- Cultural engagement (e.g., attendance at community events, library usage, volunteerism).
- Civic engagement (e.g., voter turnout, participation in forums, public feedback submissions).

##### **Infrastructure Efficiency:**

- Traffic congestion levels, average commute times, and reliability of public transit.
- Waste management efficiency (recycling rates, landfill reduction).
- Infrastructure resilience (frequency of outages, utility repair times).
- Housing availability and quality.

##### **Citizen Satisfaction and Equity:**

- Public satisfaction ratings (collected via surveys and sentiment analysis on public platforms).
- Inclusion metrics (e.g., representation in decision-making, equitable service distribution, accessibility for disabled and elderly populations).
- Overall Quality of Life Index, constructed from multiple data sources.

##### **Basic Randomness:**

- Develop a secondary backend to handle complex randomness mechanics for continuous conversations.
- Design mechanics for synthetic, realistic conversations where agents periodically stop talking or choose to initiate conversations based on contextual triggers.

---

#### 3. **Phase: Imagination and Implementation** _(3-6 days)_

- Build a framework to ensure AI agents respond dynamically to events and exhibit individual preferences.
- Develop a "city events" system where events are based on pre-defined or dynamically generated scenarios stored in an AI event framework.

##### **CCTV Integration:**

- Create a separate chatroom for monitoring AI agents.
- Notify users about AI agent activities in real-time (e.g., "Lawyer is watching TV").
- Allow users to select any AI agent from a list and view their current actions.
- Add immersive features like background sounds for certain activities (e.g., TV noises while an agent watches television).

##### **Scheduled Events:**

- Simulate real-world city schedules (e.g., bus arrival times).

##### **UI/UX Enhancements:**

- Design a more advanced UI with thoughtful UX considerations.
- Plan and implement features that provide intuitive and engaging user interactions.

##### **Final Steps:**

- Finalize the framework and launch the city.

---

#### **Additional Features:**

- Integrate Eleven Labs' sound API to add voice personalities for AI agents. When a user clicks on an agent, the agent begins to speak.
- Deploy backend servers for consistent and scalable operation. Discuss devops requirements if needed.
