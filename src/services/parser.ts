const PARSER_PATH = '/v3/universal-ai';
const PARSER_API_URL = process.env.CV_PARSER_API_URL;
const PARSER_API_KEY = process.env.CV_PARSER_API_KEY;

export const parseResume = async (url: string): Promise<ResumeData> => {
  if (!PARSER_API_URL) {
    throw new Error('PARSER_API_URL is not defined');
  }

  if (!PARSER_API_KEY) {
    throw new Error('PARSER_API_KEY is not defined');
  }

  const path = `${PARSER_API_URL}${PARSER_PATH}`;
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PARSER_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'ocr/resume_parser/affinda',
      input: {file: url},
      show_original_response: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error parsing resume: ${response.statusText}`);
  }

  const data = await response.json();

  console.log(data);

  return data;
};

export interface ResumeData {
  status: string;
  cost: string;
  provider: string;
  feature: string;
  subfeature: string;
  output: Output;
  error: any;
  original_response: any;
}

export interface Output {
  extracted_data: ExtractedData;
}

export interface ExtractedData {
  personal_infos: PersonalInfos;
  education: Education;
  work_experience: WorkExperience;
  languages: any[];
  skills: Skill[];
  certifications: any[];
  courses: any[];
  publications: any[];
  interests: any[];
}

export interface PersonalInfos {
  name: Name;
  address: Address;
  self_summary: string;
  objective: any;
  date_of_birth: any;
  place_of_birth: any;
  phones: string[];
  mails: string[];
  urls: string[];
  fax: any[];
  current_profession: any;
  gender: any;
  nationality: any;
  martial_status: any;
  current_salary: any;
  availability: any;
}

export interface Name {
  first_name: string;
  last_name: string;
  raw_name: string;
  middle: string;
  title: any;
  prefix: any;
  sufix: any;
}

export interface Address {
  formatted_location: any;
  postal_code: any;
  region: any;
  country: any;
  country_code: any;
  raw_input_location: any;
  street: any;
  street_number: any;
  appartment_number: any;
  city: any;
}

export interface Education {
  total_years_education: any;
  entries: Entry[];
}

export interface Entry {
  title: string;
  start_date: string;
  end_date: string;
  location: Location;
  establishment: string;
  description: any;
  gpa: any;
  accreditation: string;
}

export interface Location {
  formatted_location: string;
  postal_code: any;
  region: any;
  country: string;
  country_code: string;
  raw_input_location: any;
  street: any;
  street_number: any;
  appartment_number: any;
  city: any;
}

export interface WorkExperience {
  total_years_experience: string;
  entries: Entry2[];
}

export interface Entry2 {
  title: string;
  start_date?: string;
  end_date?: string;
  company?: string;
  location: Location2;
  description?: string;
  type: string;
  industry: any;
}

export interface Location2 {
  formatted_location?: string;
  postal_code: any;
  region?: string;
  country?: string;
  country_code?: string;
  raw_input_location: any;
  street: any;
  street_number: any;
  appartment_number: any;
  city?: string;
}

export interface Skill {
  name: string;
  type: string;
}
