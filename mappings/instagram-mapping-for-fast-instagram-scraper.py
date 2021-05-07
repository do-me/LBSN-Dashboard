# -*- coding: utf-8 -*-

"""
Module for mapping Instagram (json) to common LBSN Structure.
"""

# pylint: disable=no-member
import logging
import re
import sys
import shapely.geometry as geometry
import numpy as np

from typing import Dict, Any
from lbsnstructure import lbsnstructure_pb2 as lbsn
from shapely.geometry.polygon import Polygon

from lbsntransform.tools.helper_functions import HelperFunctions as HF

MAPPING_ID = 13

class importer():
    """ Provides mapping function from Instagram endpoints to
        protobuf lbsnstructure
    """
    ORIGIN_NAME = "Instagram"
    ORIGIN_ID = 1

    def __init__(self,
                 disableReactionPostReferencing=False,
                 geocodes=False,
                 mapFullRelations=False,
                 map_reactions=True,
                 ignore_non_geotagged=False,
                 ignore_sources_set=set(),
                 min_geoaccuracy=None):
        # We're dealing with Twitter in this class,
        # lets create the OriginID globally
        # this OriginID is required for all CompositeKeys
        origin = lbsn.Origin()
        origin.origin_id = lbsn.Origin.INSTAGRAM
        self.origin = origin
        # this is where all the data will be stored
        self.lbsn_records = []
        self.lbsn_relationships = []
        self.null_island = 0
        self.log = logging.getLogger('__main__')  # logging.getLogger()
        self.disable_reaction_post_referencing = disableReactionPostReferencing
        self.map_full_relations = mapFullRelations
        self.geocodes = geocodes
        self.map_reactions = map_reactions
        self.ignore_non_geotagged = ignore_non_geotagged
        self.ignore_sources_set = ignore_sources_set
        self.min_geoaccuracy = min_geoaccuracy
        self.skipped_low_geoaccuracy = 0

    def get_skipped_geoaccuracy(self):
        """Get count of records skipped due to low geoaccuracy"""
        return self.skipped_low_geoaccuracy

    def parse_json_record(self, json_string_dict, input_lbsn_type=None):
        # clear any records from previous run
        self.lbsn_records.clear()
        if json_string_dict is None:
            return

        # parse different jsons structures 
        if json_string_dict.get('data'): # [data][location][edge_location_to_media] / [edge_location_to_top_posts]
            place_json = json_string_dict.get('data').get('location')
        elif json_string_dict.get('graphql'): # [graphql][location][edge_location_to_media] / [edge_location_to_top_posts]
            place_json = json_string_dict.get('graphql').get('location')
        else:
            place_json = json_string_dict # [edge_location_to_media] / [edge_location_to_top_posts] (without header)

        if place_json is None:
            # skip all non-geotagged
            return self.lbsn_records
        place_record = self.extract_place(
            place_json)
        self.lbsn_records.append(place_record)
        # extract normal posts
        post_node_list = place_json.get(
            "edge_location_to_media").get("edges")
        if post_node_list:
            self.extract_posts(
                post_node_list, place_record)
        # extract top posts
        top_post_node_list = place_json.get(
            "edge_location_to_top_posts").get("edges")
        if top_post_node_list:
            self.extract_posts(
                top_post_node_list, place_record)
        # finally, return list of all extracted records
        return self.lbsn_records

    def extract_related_users(self, related_user_list,
                              input_lbsn_type, user_record):
        for related_user in related_user_list:
            related_record = HF.new_lbsn_record_with_id(lbsn.User(),
                                                        str(related_user),
                                                        self.origin)
            self.lbsn_records.append(related_record)
            # note the switch of order here,
            # direction is important for 'isConnected',
            # and the different list each give us a
            # different view on this relationship
            relationship_record = None
            if input_lbsn_type == 'friendslist':
                relationship_record =\
                    HF.new_lbsn_relation_with_id(lbsn.Relationship(),
                                                 user_record.pkey.id,
                                                 related_record.pkey.id,
                                                 self.origin)
            elif input_lbsn_type == 'followerslist':
                relationship_record = \
                    HF.new_lbsn_relation_with_id(lbsn.Relationship(),
                                                 related_record.pkey.id,
                                                 user_record.pkey.id,
                                                 self.origin)
            if relationship_record:
                relationship_record.relationship_type = \
                    lbsn.Relationship.isCONNECTED
                self.lbsn_relationships.append(
                    relationship_record)

    def extract_posts(
        self, node_list, place_record: lbsn.Place = None):
        for post_node in node_list:
            json_string_dict = post_node.get("node")
            if json_string_dict:
                self.extract_post(
                    json_string_dict, place_record)

    def extract_user(self, json_string_dict):
        user = json_string_dict
        user_record = HF.new_lbsn_record_with_id(lbsn.User(),
                                                 user.get(
            'id'),
            self.origin)
        return user_record

    def extract_post(
        self, json_string_dict: Dict[str, Any], place_record: lbsn.Place = None):
        post_guid = json_string_dict.get('id')
        if not HF.check_notice_empty_post_guid(post_guid):
            return None
        post_record = HF.new_lbsn_record_with_id(lbsn.Post(),
                                                 post_guid,
                                                 self.origin)
        user_record = None
        user_info = json_string_dict.get('owner')
        if user_info:
            # Get Post/Reaction Details of User
            user_record = self.extract_user(user_info)
        if user_record:
            self.lbsn_records.append(user_record)
        else:
            self.log.warning(
                f'No User record found for post: {post_guid} '
                f'(post saved without userid)..')

        # Check from upstream to update post attrs
        if place_record:
            # assign place accuracy, by default
            post_record.post_geoaccuracy = lbsn.Post.PLACE
            post_record.place_pkey.CopyFrom(place_record.pkey)
            post_record.post_latlng = place_record.geom_center
        else:
            post_record.post_geoaccuracy = None

        # if still no geoinformation, send post to Null-Island
        if not post_record.post_latlng:
            if self.ignore_non_geotagged is True:
                return None
            else:
                self.null_island += 1
                post_record.post_latlng = "POINT(%s %s)" % (0, 0)
        if self.min_geoaccuracy:
            if not HF.geoacc_within_threshold(
                    post_record.post_geoaccuracy, self.min_geoaccuracy):
                self.skipped_low_geoaccuracy += 1
                return
        post_record.post_publish_date.CopyFrom(
            HF.json_date_timestamp_to_proto(
                json_string_dict.get('taken_at_timestamp')))
        if user_record:
            post_record.user_pkey.CopyFrom(user_record.pkey)

        def value_count(x): return 0 if x is None else x
        post_record.post_comment_count = value_count(
            json_string_dict.get('edge_media_to_comment').get('count'))
        post_record.post_like_count = value_count(
            json_string_dict.get('edge_liked_by').get('count'))
        post_shortcode = json_string_dict.get('shortcode')
        post_record.post_url = f'http://www.instagram.com/p/{post_shortcode}'
        if json_string_dict.get("thumbnail_src"):
            post_record.post_thumbnail_url = json_string_dict.get(
                "thumbnail_src")
        post_caption_edge = json_string_dict.get('edge_media_to_caption')
        if post_caption_edge:
            post_caption_edge_edges = post_caption_edge.get("edges")
            if post_caption_edge_edges and not len(
                    post_caption_edge_edges) == 0:
                post_caption = post_caption_edge[
                    "edges"][0]["node"]["text"]
                post_record.post_body = post_caption.replace(
                    '\n', ' ').replace('\r', '')
                hashtags = HF.extract_hashtags_from_string(post_caption)
                if hashtags:
                    for hashtag in hashtags:
                        post_record.hashtags.append(hashtag)
        is_video = json_string_dict.get('is_video')
        if is_video:
            post_record.post_type = lbsn.Post.VIDEO
            post_record.post_views_count = value_count(
                json_string_dict.get('video_view_count'))
        else:
            post_record.post_type = lbsn.Post.IMAGE
        post_record.emoji.extend(HF.extract_emoji(post_record.post_body))
        self.lbsn_records.append(post_record)

    def extract_mentioned_users(self, ref_user_records, user_record_id):
        for mentioned_user_record in ref_user_records:
            relation_record = \
                HF.new_lbsn_relation_with_id(lbsn.Relationship(),
                                             user_record_id,
                                             mentioned_user_record.pkey.id,
                                             self.origin)
            relation_record.relationship_type = \
                lbsn.Relationship.MENTIONS_USER
            self.lbsn_records.append(
                relation_record)

    def map_postrecord_to_postreactionrecord(self, post_record):
        post_reaction_record = lbsn.PostReaction()
        post_reaction_record.pkey.CopyFrom(post_record.pkey)
        post_reaction_record.user_pkey.CopyFrom(post_record.user_pkey)
        post_reaction_record.reaction_latlng = post_record.post_latlng
        # better post_create_date, but not available from Twitter
        post_reaction_record.reaction_date.CopyFrom(
            post_record.post_publish_date)
        post_reaction_record.reaction_like_count = post_record.post_like_count
        post_reaction_record.reaction_content = post_record.post_body
        post_reaction_record.user_mentions_pkey.extend(
            [userRefPkey for userRefPkey in post_record.user_mentions_pkey])
        return post_reaction_record

    def extract_place(self, postplace_json):
        place = postplace_json
        place_id = place.get('id')
        if not place_id:
            self.log.warning(f'No PlaceGuid\n\n{place}')
            input("Press Enter to continue... (entry will be skipped)")
            return
        lon_center = place.get('lng')
        lat_center = place.get('lat')
        if lon_center is None or lat_center is None:
            # assign place to Null Island
            lon_center = 0
            lat_center = 0
        # place_guid
        # For POIs, City is not available on Twitter
        place_record = HF.new_lbsn_record_with_id(
            lbsn.Place(), place_id, self.origin)
        place_record.geom_center = "POINT(%s %s)" % (lon_center, lat_center)
        place_name = place.get('name').replace('\n\r', '')
        # for some reason, twitter place entities sometimes contain
        # linebreaks or whitespaces. We don't want this.
        place_name = place.get('name').replace('\n\r', '')
        # remove multiple whitespace
        place_name = re.sub(' +', ' ', place_name)
        place_slug = place.get('slug')
        if place_slug:
            place_record.url = (
                f"https://www.instagram.com/explore/locations/"
                f"{place_id}/{place_slug}")
        return place_record
