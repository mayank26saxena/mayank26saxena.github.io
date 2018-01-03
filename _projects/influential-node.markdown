---
layout: page
title: Influential Nodes
description: Detection of influential nodes in a graph.
img: /assets/img/projects/influential-nodes/influential-node.png
---

*Supervisors:* [Prof. R. Saxena](http://rakhisaxena.github.io/), [Prof. Sivaprasad Kumar](http://www.dtu.ac.in/Web/Departments/AppliedMathematics/faculty/sskumar.php)

### Problem Statement
All social networks are modelled as graphs. Each user is represented by a node and an edge exists between two nodes if there exists a relation between the users. In case of a social network graph, we can think of the relation being if the two users are friends with each other. On analysis of the graph, we can determine the most influential nodes in the given graph. The process of influential users can be used for targeted advertising, spreading awareness, for lesser degrees of separation etc. Influential users are those users which have a large number of edges incident on them. In the social network graph, communities (those set of users which are highly interconnected) are connected through these influential users.

### Extended Neighbourhood Centrality Algorithm (ENC)
I propose a new centrality measure that encodes the centrality of a node and its neighborhood. I consider that the importance of a node depends not only on its direct neighbors (1-step neighbors), but also on its 2-step and even more steps of neighbors. A 2-step neighbor of a node is a direct neighbor of 1-step neighbor. Similarly, a n-step neighbor is a direct neighbor of (n-1)-step neighbor. The more steps, the larger range of neighborhood is taken into consideration. Based on these assumptions, I define the neighborhood centrality of node i encoding the centrality of i as the sum of coreness of its n-step neighbors.

### Results
Results were comparable and better in some cases to Pagerank, Degree centrality and k-core centrality algorithms.

<p align="center">
    <a class="button" href="https://drive.google.com/file/d/0B6HvWGCj4u7xTzRzV0pNZURQUzQ/view?usp=sharing" target="_blank">View Report </a>
</p>

<br/>

<div class="img_true">
    <img class="col three" src="{{ site.baseurl }}/assets/img/projects/influential-nodes/enc.png" alt="" title="Influential Nodes ENC."/>
    <div class="caption">Influential nodes found using ENC Algorithm for Zachary Karate Dataset. The green colored nodes represent the most influential nodes in the network.</div>
</div>

<p>  
