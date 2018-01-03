---
layout: page
title: YouTube Like Predictor
description: A command line tool to predict the like count of a YouTube video.
img: /assets/img/projects/youtube-like-count/corplot.png
---

A command line tool to model the likes count of a YouTube video as a function of various features. Through the YouTube API I gathered video details such as View Count, Comment Count, Dislike Count, Favorite Count, Life of video, Duration, Category etc. Another set of features was gathered from the characteristics of the channel via which the video was uploaded. Some of the features in this category were Channel Subscriber Count, Channel View Count, Channel Video Count and Channel Comment Count. A third set of features was finding out the number of times the video was shared on other social media platforms such as Facebook, Google Plus, Linkedin and Pinterest.

The model which I used was the Stochastic Gradient Descent based Linear Regression model. Considering the R<sup>2</sup> metric, the model achieved a training score of 0.969 and a cross-validation score of 0.9503

<p align="center">
    <a class="button" href="https://drive.google.com/file/d/19ANUiS4kePbImvpeCL7bY5CNoZIh7yRJ/view?usp=sharing" target="_blank">View Report</a>
    <a class="button" href="https://github.com/mayank26saxena/YouTube-Video-Like-Count-Predictor" target="_blank">View Code</a>
</p>

<div class="img_true">
    <img class="col three" src="{{ site.baseurl }}/assets/img/projects/youtube-like-count/corplot.png" alt="" title="Correlation Plot."/>
    <div class="caption">Karl Pearson's Correlation coefficient plot between Like Count, View Count, Comment Count and Dislike Count.</div>
</div>
