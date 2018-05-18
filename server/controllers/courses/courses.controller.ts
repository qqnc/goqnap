import { Route, Get, Query, Controller, Body, Post, Header, Security, Path } from 'tsoa';
import { Course, UserCourseRequest, UserCourseResponse } from '../../models/course.model';
import CourseDB from '../../models/schemas/courses';
import * as YouTube from 'youtube-node';

@Route('courses')
export class CoursesController extends Controller {
  desc = true;
  orderBy = 'publishedDate';
  limit = 0;
  category = null;
  dbQuery = {};

  @Get()
  public getCourses(@Query() limit?: number, @Query() orderBy?: string, @Query() category?: string): Promise<Course []> {

    if (orderBy && orderBy.split(':')[0]) {
      this.orderBy = orderBy.split(':')[0];
      if (orderBy.split(':')[1] && orderBy.split(':')[1] === 'desc') {
        this.desc = true;
      } else {
        this.desc = false;
      }
    }
    if (limit) {
      this.limit = limit;
    }

    if (category) {
      this.category = category;
    }

    return new Promise<Course []>((resolve, reject) => {

      let sort;
      this.desc === true ? sort = '-' + this.orderBy : sort = this.orderBy;

      let promise;

      if (this.category) {
        this.dbQuery = { category: this.category };
      }
      if (this.limit === 0) {
        promise = CourseDB.find(this.dbQuery).sort(sort).exec();
      } else {
        promise = CourseDB.find(this.dbQuery).sort(sort).limit(this.limit).exec();
      }

      promise.then(
        (courses: Course []) => {
          resolve(courses);
        }
      ).catch((error) => {
        reject(error);
      });
    });
  }

  // Must place this before get by id
  @Get('search')
  public search(@Query() query: string): Promise<Course []> {
    return new Promise<Course []> ((resolve, reject) => {
      const queryStr = query;
      // console.log('search ' + queryStr);
      if (queryStr) {
        const promise = CourseDB.find({$text: {$search: queryStr}}).exec();
        promise.then(
          (courses) => {
            // console.log(courses);
            resolve(courses);
          }
        ).catch(
          (err) => {
            reject([]);
          }
        );
      } else {
        reject([]);
      }
    });
  }

  @Get('{id}')
  public getCourse(@Path() id: string): Promise<Course> {
    return new Promise<Course>((resolve, reject) => {
      const promise = CourseDB.findOne({_id: id}).exec();
      promise.then(
        (course: Course) => {
          resolve(course);
        }
      ).catch(
        error => reject(error)
      );
    });
  }

  @Get('{youtubeRef}/youtubeinfo')
  public getYoutubeInfo(youtubeRef: string): Promise<Course> {
    return new Promise<Course>((resolve, reject) => {
      const youTube = new YouTube();

      youTube.setKey(process.env.YOUTUBE_KEY);

      youTube.getById(youtubeRef, (error, info) => {
        if (error) {
          reject(error);
        } else {
          const item = info.items[0];
          // console.log(item);
          const promise = CourseDB.findOneAndUpdate(
                  { youtube_ref: youtubeRef },
                  { $set: {
                      duration: item.contentDetails.duration,
                      like: item.statistics.likeCount,
                      dislike: item.statistics.dislikeCount,
                      watched: item.statistics.viewCount,
                      favoriteCount: item.statistics.favoriteCount,
                      commentCount: item.statistics.commentCount
                    }
                  },
                  { new: true}).exec();
          promise.then(
            (course) => {
              resolve(course);
            }
          ).catch(
            (err) => {
              reject(err);
            }
          );
        }
      });
    });
  }

  @Security('jwt')
  @Post()
  public addCourse(@Body() requestBody: UserCourseRequest, @Header('x-access-token') authorization: string): Promise<UserCourseResponse> {
    return new Promise<UserCourseResponse>((resolve, reject) => {
      const course = new CourseDB();
      Object.assign(course, requestBody);
      course.save(function (error) {
        if (error) {
          reject(new UserCourseResponse(false, error, null));
        }

        this.getYoutubeInfo(course.youtube_ref).then(
          (res_course: Course) => {
            resolve(new UserCourseResponse(true, 'Create a course successfully', res_course));
          }
        ).catch(error1 => reject(new UserCourseResponse(false, 'The youtube reference does not exist.', null)));
      });
    });
  }
}
