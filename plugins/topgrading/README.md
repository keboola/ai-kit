# Topgrading Plugin

Topgrading methodology skills for hiring excellence - helping organizations consistently hire A Players (top 10% of talent).

## Overview

The Topgrading plugin provides AI-powered skills to support the complete hiring lifecycle using the proven Topgrading methodology developed by Dr. Bradford Smart. Organizations that properly implement Topgrading report 75-90% A Player hiring success rates, compared to the industry average of 25%.

## Skills

### 1. scorecard-creator

**Purpose**: Create comprehensive job scorecards with mission statements, measurable accountabilities, and competency requirements.

**Use when**:
- Defining a new role
- Preparing to hire for a position
- Formalizing job expectations
- Updating existing role definitions

**Features**:
- Mission statement generation
- 10-15 measurable accountabilities with metrics
- 15-20 competency selection with Minimum Acceptable Ratings (MAR)
- Support for individual contributor and managerial roles
- 80+ competencies across categories (Sales, Behavioral, Intellectual, Motivational, Keboola-specific, Managerial)

**Example**:
```
/topgrading:scorecard-creator

Create a scorecard for a Senior Software Engineer role
```

---

### 2. interview-guide

**Purpose**: Generate structured Topgrading interview guides based on job scorecards.

**Use when**:
- Preparing for candidate interviews
- Training new interviewers
- Standardizing interview process

**Features**:
- Chronological career history interview structure
- Five core questions per job position
- 18+ follow-up probing questions
- TORC (Threat of Reference Check) setup scripts
- Competency-specific behavioral questions
- Tandem interview support

**Example**:
```
/topgrading:interview-guide

Generate an interview guide for the Senior Software Engineer scorecard
```

---

### 3. candidate-evaluator

**Purpose**: Evaluate candidates against job scorecards after interviews.

**Use when**:
- Completing post-interview assessment
- Comparing candidates objectively
- Making hire/no-hire decisions
- Preparing for reference checks

**Features**:
- Competency rating with behavioral evidence (4-point scale)
- A/B/C Player classification
- Red flag identification
- Strengths and concerns analysis
- Hire recommendation with rationale
- Reference check priority questions

**Example**:
```
/topgrading:candidate-evaluator

Evaluate the candidate based on these interview notes and the scorecard
```

---

### 4. interview-coach

**Purpose**: Train and coach interviewers on the Topgrading methodology.

**Use when**:
- Onboarding new interviewers
- Improving interview quality
- Reviewing interviewer performance
- Preparing for specific interviews

**Features**:
- Core Topgrading concepts and philosophy
- TORC technique training
- Probing skills development
- 24-point interviewer feedback framework
- Common mistakes and fixes
- Pre-interview preparation guidance

**Example**:
```
/topgrading:interview-coach

Train me on the TORC technique for reference checks
```

---

## Templates

The plugin includes markdown templates for creating scorecards:

- `templates/individual-scorecard.md` - For individual contributor roles
- `templates/managerial-scorecard.md` - For managerial/leadership roles

## Key Concepts

### A/B/C Player Classification

| Classification | Definition | Hire Decision |
|---------------|------------|---------------|
| **A Player** | Top 10% of talent for the role at compensation offered | Strong Yes |
| **B Player** | Capable but not top 10%; meets most expectations | Maybe |
| **C Player** | Does not meet expectations; would not rehire | No |

### TORC (Threat of Reference Check)

A methodology that creates an environment where honesty is the candidate's best strategy:
1. Set expectation early that candidate will arrange reference calls
2. Ask at each job: "What would your manager say about you?"
3. Follow through with actual reference calls

### The Five Core Questions (Per Job)

1. What were you hired to do?
2. What accomplishments are you most proud of?
3. What were some low points during that job?
4. Who were the people you worked with?
5. Why did you leave that job?

## Installation

```bash
/plugin install topgrading
```

## Usage

After installation, invoke skills using:

```
/topgrading:scorecard-creator
/topgrading:interview-guide
/topgrading:candidate-evaluator
/topgrading:interview-coach
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024 | Initial release with 4 skills |

## References

- [Topgrading by Dr. Bradford Smart](https://topgrading.com/)
- Foolproof Hiring methodology
- 80+ competency definitions based on Topgrading framework

## Support

For issues or feature requests, contact support@keboola.com
