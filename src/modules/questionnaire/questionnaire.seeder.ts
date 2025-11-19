import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Questionnaire, QuestionnaireType } from './entities/questionnaire.entity';
import { Question, QuestionType, DisplayStyle } from './entities/question.entity';
import { QuestionOption } from './entities/question-option.entity';

@Injectable()
export class QuestionnaireSeeder {
  constructor(
    @InjectRepository(Questionnaire)
    private questionnaireRepo: Repository<Questionnaire>,
    @InjectRepository(Question)
    private questionRepo: Repository<Question>,
    @InjectRepository(QuestionOption)
    private optionRepo: Repository<QuestionOption>,
  ) {}

  async seed() {
    // Check if questionnaires already exist
    const existing = await this.questionnaireRepo.count();
    if (existing > 0) {
      console.log('Questionnaires already seeded. Skipping...');
      return;
    }

    // Seed User Questionnaire
    await this.seedUserQuestionnaire();

    // Seed Advisor Questionnaire
    await this.seedAdvisorQuestionnaire();

    console.log('Questionnaires seeded successfully!');
  }

  private async seedUserQuestionnaire() {
    const questionnaire = this.questionnaireRepo.create({
      title: 'Welcome to Sidekix',
      description: 'Help us understand your needs and challenges',
      type: QuestionnaireType.USER,
      isActive: true,
      displayOrder: 1,
    });
    const savedQuestionnaire = await this.questionnaireRepo.save(questionnaire);

    // Question 1: What brings you here?
    const question1 = this.questionRepo.create({
      questionnaireId: savedQuestionnaire.id,
      text: 'What brings you here?',
      type: QuestionType.SINGLE_CHOICE,
      displayStyle: DisplayStyle.TAB,
      isRequired: true,
      stepNumber: 1,
      displayOrder: 1,
    });
    const savedQuestion1 = await this.questionRepo.save(question1);

    const options1 = [
      'I have a business idea',
      'I need a business idea',
      "I own a business and I'm looking for support",
      'My business is growing and I need guidance',
      'I am looking for a supportive community',
      'Other',
    ];

    for (let i = 0; i < options1.length; i++) {
      await this.optionRepo.save(
        this.optionRepo.create({
          questionId: savedQuestion1.id,
          label: options1[i],
          value: options1[i].toLowerCase().replace(/\s+/g, '_'),
          displayOrder: i + 1,
        }),
      );
    }

    // Question 2: What challenges are you facing?
    const question2 = this.questionRepo.create({
      questionnaireId: savedQuestionnaire.id,
      text: 'What challenges are you facing?',
      subtitle: 'Select all that apply',
      type: QuestionType.MULTIPLE_CHOICE,
      displayStyle: DisplayStyle.TAB,
      isRequired: true,
      stepNumber: 2,
      displayOrder: 2,
    });
    const savedQuestion2 = await this.questionRepo.save(question2);

    const options2 = [
      'Fear of failure',
      "I don't know where to start",
      'Lack of support',
      'Navigating resources',
      'Funding',
      'Missing a skill',
      'Limited network or connections',
      'Other',
    ];

    for (let i = 0; i < options2.length; i++) {
      await this.optionRepo.save(
        this.optionRepo.create({
          questionId: savedQuestion2.id,
          label: options2[i],
          value: options2[i].toLowerCase().replace(/\s+/g, '_'),
          displayOrder: i + 1,
        }),
      );
    }
  }

  private async seedAdvisorQuestionnaire() {
    const questionnaire = this.questionnaireRepo.create({
      title: 'Advisor Application',
      description: 'Tell us about your business experience and expertise',
      type: QuestionnaireType.ADVISOR,
      isActive: true,
      displayOrder: 2,
    });
    const savedQuestionnaire = await this.questionnaireRepo.save(questionnaire);

    // Step 1: Business Experience
    const question1 = this.questionRepo.create({
      questionnaireId: savedQuestionnaire.id,
      text: 'How long have you been a business owner?',
      type: QuestionType.TEXT,
      displayStyle: DisplayStyle.TEXT_INPUT,
      isRequired: true,
      stepNumber: 1,
      displayOrder: 1,
    });
    await this.questionRepo.save(question1);

    // Question 2: Business Type
    const question2 = this.questionRepo.create({
      questionnaireId: savedQuestionnaire.id,
      text: 'What type of business(s) do you own?',
      subtitle: 'Select all that apply',
      type: QuestionType.MULTIPLE_CHOICE,
      displayStyle: DisplayStyle.CHECKBOX,
      isRequired: true,
      stepNumber: 1,
      displayOrder: 2,
    });
    const savedQuestion2 = await this.questionRepo.save(question2);

    const businessTypes = [
      {
        label: 'Product-based',
        value: 'product_based',
        description: 'e.g., retail, online shop, handmade goods',
      },
      {
        label: 'Service-based',
        value: 'service_based',
        description: 'e.g., consulting, freelancing, coaching',
      },
      {
        label: 'Food & Beverage',
        value: 'food_beverage',
        description: 'e.g., restaurant, catering, food truck',
      },
      {
        label: 'Creative / Media',
        value: 'creative_media',
        description: 'e.g., photography, design, content',
      },
      { label: 'Other', value: 'other' },
    ];

    for (let i = 0; i < businessTypes.length; i++) {
      await this.optionRepo.save(
        this.optionRepo.create({
          questionId: savedQuestion2.id,
          label:
            businessTypes[i].label +
            (businessTypes[i].description ? ` (${businessTypes[i].description})` : ''),
          value: businessTypes[i].value,
          displayOrder: i + 1,
        }),
      );
    }

    // Question 3: Previous Advisor Experience
    const question3 = this.questionRepo.create({
      questionnaireId: savedQuestionnaire.id,
      text: 'Do you have previous experience as a business advisor?',
      type: QuestionType.SINGLE_CHOICE,
      displayStyle: DisplayStyle.RADIO,
      isRequired: true,
      stepNumber: 1,
      displayOrder: 3,
    });
    const savedQuestion3 = await this.questionRepo.save(question3);

    await this.optionRepo.save([
      this.optionRepo.create({
        questionId: savedQuestion3.id,
        label: 'Yes',
        value: 'yes',
        displayOrder: 1,
      }),
      this.optionRepo.create({
        questionId: savedQuestion3.id,
        label: 'No',
        value: 'no',
        displayOrder: 2,
      }),
    ]);

    // Question 4: Explain Experience
    const question4 = this.questionRepo.create({
      questionnaireId: savedQuestionnaire.id,
      text: 'Please explain',
      type: QuestionType.TEXTAREA,
      displayStyle: DisplayStyle.TEXTAREA,
      isRequired: false,
      stepNumber: 1,
      displayOrder: 4,
      validation: {
        minLength: 10,
        maxLength: 1000,
      },
    });
    await this.questionRepo.save(question4);

    // Step 2: Area of Expertise
    const question5 = this.questionRepo.create({
      questionnaireId: savedQuestionnaire.id,
      text: 'Area of expertise',
      subtitle: 'Select all that apply',
      type: QuestionType.MULTIPLE_CHOICE,
      displayStyle: DisplayStyle.TAB,
      isRequired: true,
      stepNumber: 2,
      displayOrder: 1,
    });
    const savedQuestion5 = await this.questionRepo.save(question5);

    const expertiseAreas = [
      'Idea Validation',
      'Market Fit',
      'Small Business',
      'Business Planning',
      'Marketing & Sales',
      'Product Development',
      'Legal & Compliance',
      'Operations & Scaling',
      'Customer Experience & Retention',
      'Branding & Positioning',
      'Team & Leadership Development',
      'HR and Recruitment',
      'Funding & Investment',
      'Technology & Automation',
      'Customer Acquisition',
      'Sustainability & Green Business Practices',
      'Franchise Development',
      'Finance & Budgeting',
      'Other',
    ];

    for (let i = 0; i < expertiseAreas.length; i++) {
      await this.optionRepo.save(
        this.optionRepo.create({
          questionId: savedQuestion5.id,
          label: expertiseAreas[i],
          value: expertiseAreas[i].toLowerCase().replace(/\s+/g, '_'),
          displayOrder: i + 1,
        }),
      );
    }

    // Step 3: Key Strengths
    const question6 = this.questionRepo.create({
      questionnaireId: savedQuestionnaire.id,
      text: 'Key strengths',
      subtitle: 'Select all that apply',
      type: QuestionType.MULTIPLE_CHOICE,
      displayStyle: DisplayStyle.TAB,
      isRequired: true,
      stepNumber: 3,
      displayOrder: 1,
    });
    const savedQuestion6 = await this.questionRepo.save(question6);

    const strengths = [
      'Strategic Decision-Making',
      'Networking & Relationship Building',
      'Resilience',
      'Self-Awareness',
      'Visionary Thinking & Purpose',
      'Listening',
      'Business Model Design',
      'Creative Problem Solving',
      'Customer Discovery',
      'Lean Thinking',
      'Goal Setting',
      'Prioritization',
      'Adaptability',
      'Leadership',
      'Mindset',
      'Emotional Intelligence',
      'Other',
    ];

    for (let i = 0; i < strengths.length; i++) {
      await this.optionRepo.save(
        this.optionRepo.create({
          questionId: savedQuestion6.id,
          label: strengths[i],
          value: strengths[i].toLowerCase().replace(/\s+/g, '_'),
          displayOrder: i + 1,
        }),
      );
    }

    // Step 4: Additional Information
    const question7 = this.questionRepo.create({
      questionnaireId: savedQuestionnaire.id,
      text: 'LinkedIn',
      type: QuestionType.TEXT,
      displayStyle: DisplayStyle.TEXT_INPUT,
      isRequired: false,
      stepNumber: 4,
      displayOrder: 1,
    });
    await this.questionRepo.save(question7);

    const question8 = this.questionRepo.create({
      questionnaireId: savedQuestionnaire.id,
      text: 'Website (Optional)',
      type: QuestionType.TEXT,
      displayStyle: DisplayStyle.TEXT_INPUT,
      isRequired: false,
      stepNumber: 4,
      displayOrder: 2,
    });
    await this.questionRepo.save(question8);

    const question9 = this.questionRepo.create({
      questionnaireId: savedQuestionnaire.id,
      text: 'Resume (Optional)',
      type: QuestionType.FILE_UPLOAD,
      displayStyle: DisplayStyle.FILE_UPLOAD,
      isRequired: false,
      stepNumber: 4,
      displayOrder: 3,
    });
    await this.questionRepo.save(question9);

    const question10 = this.questionRepo.create({
      questionnaireId: savedQuestionnaire.id,
      text: 'Describe a challenge that pushed you as a business owner.',
      type: QuestionType.TEXTAREA,
      displayStyle: DisplayStyle.TEXTAREA,
      isRequired: true,
      stepNumber: 4,
      displayOrder: 4,
      validation: {
        minLength: 50,
        maxLength: 2000,
      },
    });
    await this.questionRepo.save(question10);

    const question11 = this.questionRepo.create({
      questionnaireId: savedQuestionnaire.id,
      text: 'Why do you want to be a Sidekix Advisor?',
      type: QuestionType.TEXTAREA,
      displayStyle: DisplayStyle.TEXTAREA,
      isRequired: true,
      stepNumber: 4,
      displayOrder: 5,
      validation: {
        minLength: 50,
        maxLength: 2000,
      },
    });
    await this.questionRepo.save(question11);
  }
}
