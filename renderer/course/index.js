// The course: all twelve levels. Levels 1 to 5 and 6 to 12 were written and fact-checked in two passes.
import { level1 } from './levels/level-01.js'
import { level2 } from './levels/level-02.js'
import { level3 } from './levels/level-03.js'
import { level4 } from './levels/level-04.js'
import { level5 } from './levels/level-05.js'
import { level6 } from './levels/level-06.js'
import { level7 } from './levels/level-07.js'
import { level8 } from './levels/level-08.js'
import { level9 } from './levels/level-09.js'
import { level10 } from './levels/level-10.js'
import { level11 } from './levels/level-11.js'
import { level12 } from './levels/level-12.js'

export const COURSE = { levels: [level1, level2, level3, level4, level5, level6, level7, level8, level9, level10, level11, level12] }

export { validateCourse } from './course-schema.js'
export * from './course-engine.js'
