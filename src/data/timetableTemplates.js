// Reusable weekly timetable templates the mentor can apply to a student in one
// click, then fine-tune in the per-student grid. Branch-specific so the subjects
// match the student's stream. `days` matches the Timetable model / editor shape.

const T = (day, subject, topic, targetHours, description = '') =>
  ({ day, subject, topic, targetHours, description })

export const TIMETABLE_TEMPLATES = {
  CSE: [
    {
      name: 'CSE — Foundation (4–5h/day)',
      days: [
        T('Monday', 'Data Structures', 'Arrays, Linked Lists, Stacks', 4),
        T('Tuesday', 'Algorithms', 'Sorting & Searching', 4),
        T('Wednesday', 'DBMS', 'ER Model, Normalization', 4),
        T('Thursday', 'Operating Systems', 'Processes & Scheduling', 4),
        T('Friday', 'Computer Networks', 'OSI/TCP-IP, Routing', 4),
        T('Saturday', 'Engineering Maths + Aptitude', 'Linear Algebra, Probability', 5, 'Mixed practice'),
        T('Sunday', 'Revision + Mock', 'Weekly recap + 1 sectional test', 3, 'Light day'),
      ],
    },
    {
      name: 'CSE — Intensive (6–7h/day)',
      days: [
        T('Monday', 'Algorithms', 'Greedy, DP, Graphs', 6),
        T('Tuesday', 'Theory of Computation', 'Automata, CFG', 6),
        T('Wednesday', 'Operating Systems', 'Memory, Deadlocks', 6),
        T('Thursday', 'DBMS + Compiler', 'Transactions, Parsing', 6),
        T('Friday', 'Computer Networks', 'TCP, IP addressing', 6),
        T('Saturday', 'Full-length Mock Test', 'Timed test + analysis', 7, 'Simulate exam'),
        T('Sunday', 'Weakness Revision', 'Revisit weak topics', 4),
      ],
    },
  ],
  ECE: [
    {
      name: 'ECE — Foundation (4–5h/day)',
      days: [
        T('Monday', 'Networks', 'Theorems, Transients', 4),
        T('Tuesday', 'Signals & Systems', 'LTI, Fourier', 4),
        T('Wednesday', 'Electronic Devices', 'PN junction, BJT/MOSFET', 4),
        T('Thursday', 'Analog Circuits', 'Amplifiers, Op-amps', 4),
        T('Friday', 'Digital Circuits', 'Combinational & Sequential', 4),
        T('Saturday', 'Engineering Maths + Aptitude', 'Calculus, Probability', 5),
        T('Sunday', 'Revision + Mock', 'Weekly recap + sectional', 3),
      ],
    },
    {
      name: 'ECE — Intensive (6–7h/day)',
      days: [
        T('Monday', 'Control Systems', 'Root locus, Bode', 6),
        T('Tuesday', 'Communications', 'AM/FM, Digital comm', 6),
        T('Wednesday', 'Signals & Systems', 'Z-transform, DFT', 6),
        T('Thursday', 'Electromagnetics', 'Transmission lines, Waveguides', 6),
        T('Friday', 'Analog + Digital', 'Mixed problem solving', 6),
        T('Saturday', 'Full-length Mock Test', 'Timed test + analysis', 7),
        T('Sunday', 'Weakness Revision', 'Revisit weak topics', 4),
      ],
    },
  ],
  EE: [
    {
      name: 'EE — Foundation (4–5h/day)',
      days: [
        T('Monday', 'Networks', 'Theorems, Two-port', 4),
        T('Tuesday', 'Signals & Systems', 'LTI, Laplace', 4),
        T('Wednesday', 'Electrical Machines', 'Transformers, DC machines', 4),
        T('Thursday', 'Power Systems', 'Load flow, Fault analysis', 4),
        T('Friday', 'Control Systems', 'Stability, Compensators', 4),
        T('Saturday', 'Engineering Maths + Aptitude', 'Linear Algebra, Numerical', 5),
        T('Sunday', 'Revision + Mock', 'Weekly recap + sectional', 3),
      ],
    },
    {
      name: 'EE — Intensive (6–7h/day)',
      days: [
        T('Monday', 'Power Electronics', 'Converters, Inverters', 6),
        T('Tuesday', 'Electrical Machines', 'Induction & Synchronous', 6),
        T('Wednesday', 'Power Systems', 'Protection, Stability', 6),
        T('Thursday', 'Measurements', 'Bridges, Instruments', 6),
        T('Friday', 'Control + Analog', 'Mixed problem solving', 6),
        T('Saturday', 'Full-length Mock Test', 'Timed test + analysis', 7),
        T('Sunday', 'Weakness Revision', 'Revisit weak topics', 4),
      ],
    },
  ],
}

// Subject suggestions per branch (for the editor's quick-pick datalist).
export const BRANCH_SUBJECTS = {
  CSE: ['Data Structures', 'Algorithms', 'DBMS', 'Operating Systems', 'Computer Networks',
    'Theory of Computation', 'Compiler Design', 'Digital Logic', 'Computer Organization',
    'Discrete Mathematics', 'Engineering Maths', 'Aptitude', 'Revision', 'Mock Test'],
  ECE: ['Networks', 'Signals & Systems', 'Electronic Devices', 'Analog Circuits', 'Digital Circuits',
    'Control Systems', 'Communications', 'Electromagnetics', 'Engineering Maths', 'Aptitude',
    'Revision', 'Mock Test'],
  EE: ['Networks', 'Signals & Systems', 'Electrical Machines', 'Power Systems', 'Control Systems',
    'Power Electronics', 'Measurements', 'Analog Electronics', 'Digital Electronics',
    'Engineering Maths', 'Aptitude', 'Revision', 'Mock Test'],
}

export const getTemplatesForBranch = (branch) => TIMETABLE_TEMPLATES[branch] || TIMETABLE_TEMPLATES.CSE
export const getSubjectsForBranch = (branch) => BRANCH_SUBJECTS[branch] || BRANCH_SUBJECTS.CSE
