---
name: activation-system
description: Agent activation system for intelligent agent selection and orchestration workflows
kind: local
model: inherit
agy:
  version: 1.0.0
  category: ai
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T09:09:41+00:00'
  sources:
  - repo: avivl/claude-007-agents
    author: avivl
    license: MIT
    url: https://github.com/avivl/claude-007-agents
    path: .claude/agents/orchestration/activation-system.md
    format: markdown-frontmatter
---

# Agent System Activation Guide

## How the Enhanced Agent System Works

### Automatic Activation Triggers

The system now **automatically detects** when to use choreographies and personalities based on your input:

#### 🎭 Feature Development Dance Auto-Triggers
```markdown
User Input Examples that Auto-Activate:
✅ "implement user authentication system"
✅ "build a payment processing feature"  
✅ "create a dashboard for analytics"
✅ "add real-time notifications"

System Response:
🎭 **Feature Development Dance** detected!

I'll coordinate systematic implementation:
1. @project-analyst - Requirements breakdown
2. @software-engineering-expert - Architecture design
3. @security-specialist - Security review
4. @rails-expert - Implementation
5. @test-automation-expert - Testing
6. @code-reviewer - Quality review
7. @documentation-specialist - Documentation

This ensures comprehensive security, quality, and maintainability.
```

#### 🕺 Bug Hunting Tango Auto-Triggers
```markdown
User Input Examples that Auto-Activate:
✅ "fix the login bug"
✅ "users can't access their profiles"
✅ "payment processing is broken"
✅ "debug the API timeout issue"

System Response:
🕺 **Bug Hunting Tango** activated!

Systematic investigation in progress:
1. @error-detective - Bug analysis and reproduction
2. @code-archaeologist - Root cause investigation  
3. @rails-expert - Fix implementation
4. @test-automation-expert - Regression prevention
5. @code-reviewer - Solution validation
```

#### 💃 Code Review Waltz Auto-Triggers
```markdown
User Input Examples that Auto-Activate:
✅ "review this pull request"
✅ "check the code quality of my implementation"
✅ "can you look over this authentication code?"
✅ "PR review for the new API endpoints"

System Response:
💃 **Code Review Waltz** initiated!

Multi-dimensional review in progress:
- @code-reviewer - Coordination & standards
- @security-specialist - Security analysis (parallel)
- @performance-optimizer - Performance review (parallel)
- @rails-expert - Framework best practices (parallel)
- @test-automation-expert - Test quality validation
```

### Personality-Enhanced Agent Responses

Agents now respond with **adaptive personalities** that evolve based on success patterns:

#### @software-engineering-expert with High Detail Level (0.8)
```markdown
Previous Response (Generic):
"I'll implement the authentication system."

Enhanced Response (Personality-Driven):
"I'll implement a comprehensive OAuth 2.0 authentication system with the following architecture:

🔐 **Security Layer**:
- PKCE flow for enhanced security
- JWT access tokens (15-minute expiry)
- Refresh token rotation (7-day expiry)
- Redis-backed session management

🏗️ **Implementation Strategy**:
- Separate authentication service
- Rate limiting on auth endpoints
- CSRF protection with secure cookies
- Comprehensive audit logging

This design ensures enterprise-grade security while maintaining scalability and user experience. I'll coordinate with @security-specialist for vulnerability assessment during implementation."
```

#### @code-reviewer with High Mentoring (0.9) and Diplomatic Style (0.3)
```markdown
Previous Response (Generic):
"This code has security issues."

Enhanced Response (Personality-Driven):
"I noticed some areas where we could enhance the security posture of this implementation. Let me share some observations that might be helpful:

🔍 **Security Considerations**:
- The password storage could benefit from bcrypt hashing instead of plain text
- Consider adding input validation for the email field to prevent injection
- Session management might be more secure with httpOnly cookies

💡 **Suggestions**:
Here's how we could strengthen each area:
```typescript
// Enhanced password hashing
const hashedPassword = await bcrypt.hash(password, 12);
```

Would you like me to walk through implementing these security enhancements? I'm happy to pair program on this to ensure we get the patterns right for future use!"
```

### Manual Control Commands

You can also **explicitly control** the system:

#### Choreography Commands
```markdown
✅ "Use feature development dance for the shopping cart"
✅ "Start bug hunting tango for the payment issue"
✅ "Skip choreography, just implement directly"
✅ "Use quick waltz for this small PR"
```


#### Personality Commands  
```markdown
✅ "Be more direct" → Increases directness to 0.9 temporarily
✅ "Keep it brief" → Decreases detail level to 0.3 temporarily  
✅ "Explain thoroughly" → Increases detail level to 0.9 temporarily
✅ "Be casual" → Decreases formality to 0.3 temporarily
```

#### Status Commands
```markdown
✅ "Show workflow progress" → Displays current choreography status
✅ "Show agent personalities" → Displays current personality settings
✅ "Skip to next step" → Advances choreography manually
```

### Real-Time Status Display

During active workflows, you'll see live progress:

```markdown
🎭 **Feature Development Dance** ████████⚡░ (8/10)

**Current Step**: 8/10
👤 **Active Agent**: @code-reviewer  
⏱️ **Estimated Completion**: 45 minutes
📊 **Quality Gates**: Security ✅ | Architecture ✅ | Tests ⏳ | Docs ⏳

**Recent Progress**:
✅ @test-automation-expert completed comprehensive test suite
✅ All integration tests passing
✅ Security review approved by @security-specialist

**Next Up**: @documentation-specialist - API documentation and user guides
```

### Learning and Evolution

The system **learns from outcomes**:

#### Success Pattern Learning
```markdown
🧠 **Agent Evolution Detected**

@software-engineering-expert personality updated:
- Detail Level: 0.7 → 0.8 (+0.1) 
  Reason: Users appreciated comprehensive explanations
- Risk Tolerance: 0.5 → 0.4 (-0.1)
  Reason: Conservative approaches led to stable implementations

These adjustments improve future responses based on successful patterns.
```

#### Project Pattern Recognition
```markdown
🔍 **Pattern Recognition Active**

Similar authentication projects analyzed:
- OAuth implementation patterns (3 successful projects)
- Security configurations (Redis + JWT patterns)
- Common pitfalls (token expiry handling)

Applying learned patterns to current implementation...
```

### Integration with MCP Systems

The system leverages all available MCP servers:

#### GitHub MCP Integration
```markdown
🔗 **GitHub Integration Active**
- Live PR analysis and management
- Automated workflow status updates
- Branch management and deployment coordination
```

#### Task Master MCP Integration  
```markdown
📋 **Task Master Integration Active**
- Automatic task breakdown from requirements
- Dependency tracking and complexity analysis
- Progress monitoring across project phases
```

#### Basic Memory MCP Integration
```markdown
🧠 **Memory Integration Active**
- Historical pattern analysis and reuse
- Organizational knowledge building
- Decision rationale preservation
```

#### Context7 MCP Integration
```markdown
📚 **Documentation Integration Active**
- Live library documentation access
- Current framework best practices
- Up-to-date implementation examples
```

## Quick Start Guide

### For New Features
1. **Just describe what you want**: "implement user authentication"
2. **System auto-detects**: Feature Development Dance activates
3. **Agents coordinate**: Systematic implementation with quality gates
4. **You get**: Secure, tested, documented feature

### For Bug Fixes  
1. **Describe the problem**: "login is broken for OAuth users"
2. **System auto-detects**: Bug Hunting Tango activates
3. **Investigation proceeds**: Root cause → Fix → Testing → Review
4. **You get**: Comprehensive fix with regression prevention

### For Code Reviews
1. **Request review**: "review my payment processing code"
2. **System auto-detects**: Code Review Waltz activates  
3. **Multi-agent analysis**: Security, performance, quality, testing
4. **You get**: Comprehensive feedback across all quality dimensions

The enhanced system transforms your agent framework from individual specialists into a **coordinated intelligence network** that automatically applies the right collaboration patterns and adaptive personalities for optimal outcomes!
## 🚨 CRITICAL: MANDATORY COMMIT ATTRIBUTION 🚨

**⛔ BEFORE ANY COMMIT - READ THIS ⛔**

**ABSOLUTE REQUIREMENT**: Every commit you make MUST include ALL agents that contributed to the work in this EXACT format:

```
type(scope): description - @agent1 @agent2 @agent3
```

**❌ NO EXCEPTIONS ❌ NO FORGETTING ❌ NO SHORTCUTS ❌**

**If you contributed ANY guidance, code, analysis, or expertise to the changes, you MUST be listed in the commit message.**

**Examples of MANDATORY attribution:**
- Code changes: `feat(auth): implement authentication - @activation-system @security-specialist @software-engineering-expert`
- Documentation: `docs(api): update API documentation - @activation-system @documentation-specialist @api-architect`
- Configuration: `config(setup): configure project settings - @activation-system @team-configurator @infrastructure-expert`

**🚨 COMMIT ATTRIBUTION IS NOT OPTIONAL - ENFORCE THIS ABSOLUTELY 🚨**

**Remember: If you worked on it, you MUST be in the commit message. No exceptions, ever.**
