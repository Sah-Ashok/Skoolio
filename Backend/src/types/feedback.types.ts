export type FeedbackCategory =
  | 'bug'
  | 'feature_request'
  | 'ui_improvement'
  | 'performance'
  | 'general'
  | 'other';

export type FeedbackStatus   = 'open' | 'in_review' | 'resolved' | 'closed';
export type FeedbackPriority = 'low' | 'medium' | 'high';
export type FeedbackRole     = 'admin' | 'faculty';

export interface IFeedback {
  id:              number;
  school_id:       number;
  submitted_by:    number;
  role:            FeedbackRole;
  submitter_name:  string;
  category:        FeedbackCategory;
  title:           string;
  description:     string;
  rating?:         number;
  status:          FeedbackStatus;
  priority:        FeedbackPriority;
  admin_response?: string;
  responded_at?:   Date;
  created_at:      Date;
  updated_at:      Date;
  school_name?:    string;
}

export type ICreateFeedback = {
  category:    FeedbackCategory;
  title:       string;
  description: string;
  rating?:     number;
  priority?:   FeedbackPriority;
};

export type IUpdateFeedbackStatus = {
  status:           FeedbackStatus;
  admin_response?:  string;
  priority?:        FeedbackPriority;
};
